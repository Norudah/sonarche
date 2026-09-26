"""Enrich a whole album's items against one MusicBrainz release.

Every file is fingerprinted, a release is voted from sampled recordings, and
items map to tracks by recording id (duration rescues unidentified files).
In-batch duplicates are dropped and bonus tracks from sibling editions are
adopted. Per-track enrichment is the fallback when no release emerges."""

import os
import time

import enrich
import forced_album
import metadata
import protocol
import provenance
import provisional
import suspect
from album_fallback import (
    absorb_strays,
    enrich_per_track,
    finalize_fallback,
    single_album_fallback,
    tag_unidentified,
)
from album_match import (
    build_match,
    find_content_duplicates,
    rescue_coverage,
    rescue_slots,
    text_album_match,
    vote_release_id,
)
from album_rows import embed_album_cover, fetch_album_cover
from report import build_report

_DEFAULT_FETCH_PAUSE_SECONDS = 1.0


# AcoustID allows 3 req/s per key.
_DEFAULT_LOOKUP_PAUSE_SECONDS = 0.5


def _apply_hints(items, hints: dict, artist: str | None) -> None:
    """In-memory only: text matching degrades badly on empty tags."""
    for item in items:
        hint = hints.get(item.id) or {}
        if hint.get("title"):
            item.title = hint["title"]
        if artist:
            item.artist = artist
        if hint.get("index"):
            item.track = int(hint["index"])


def _fingerprint_all(request_id: str, items, params: dict) -> dict[int, list[str]]:
    """{item_id: [recording ids]} for every item. A bad file yields []."""
    recordings: dict[int, list[str]] = {}
    total = len(items)
    lookup_pause = max(
        0.0, float(params.get("lookup_pause_seconds", _DEFAULT_LOOKUP_PAUSE_SECONDS))
    )
    protocol.log(f"enrich_album: fingerprinting {total} file(s)")
    for done, item in enumerate(items):
        path = enrich._decode_path(item)
        if not os.path.exists(path):
            recordings[item.id] = []
            continue
        protocol.log(f"enrich_album: fingerprint {done + 1}/{total}: {os.path.basename(path)}")
        protocol.send_event(
            request_id,
            "enrich_progress",
            {"stage": "fingerprint", "done": done, "total": total, "item_id": item.id},
        )
        try:
            duration, fingerprint = enrich._fingerprint(params["fpcalc"], path)
            # Store now, before `_apply_hints` mutates the item in memory.
            provenance.mark_fingerprinted(item)
            item.store()
            protocol.send_event(
                request_id,
                "enrich_progress",
                {"stage": "lookup", "done": done, "total": total, "item_id": item.id},
            )
            recordings[item.id] = enrich._lookup_recordings(
                params["acoustid_key"], fingerprint, duration
            )
            protocol.log(f"enrich_album: fingerprint ok ({len(recordings[item.id])} recording(s))")
        except Exception as exc:
            protocol.log(f"enrich_album: item {item.id} fingerprint failed: {exc}")
            recordings[item.id] = []
        if lookup_pause > 0 and done < total - 1:
            time.sleep(lookup_pause)
    return recordings


def _remove_duplicates(
    request_id: str, lib, items, recordings: dict
) -> tuple[list, dict[int, int]]:
    """Delete items duplicating an earlier item's recording, before matching.
    Returns (kept items, {removed id: kept id})."""
    duplicates = find_content_duplicates(
        [(item.id, list(recordings.get(item.id) or ())) for item in items]
    )
    kept = [item for item in items if item.id not in duplicates]
    for item in items:
        if item.id not in duplicates:
            continue
        protocol.log(
            f"enrich_album: item {item.id} duplicates item {duplicates[item.id]}, removing"
        )
        try:
            item.remove(delete=True)
        except Exception as exc:
            protocol.log(f"enrich_album: duplicate removal failed: {exc}")
        protocol.send_event(
            request_id, "enrich_progress", {"stage": "track_done", "item_id": item.id}
        )
    return kept, duplicates


def _remove_library_duplicates(
    request_id: str, lib, items, recordings: dict
) -> tuple[list, dict[int, int]]:
    """Delete new items whose primary recording the library already holds
    (keyed on `mb_trackid`). Returns (kept items, {removed id: library item id})."""
    from beets.dbcore.query import MatchQuery

    batch_ids = {item.id for item in items}
    kept, duplicates = [], {}
    for item in items:
        primary = next(iter(recordings.get(item.id) or ()), None)
        existing = None
        if primary:
            existing = next(
                (
                    candidate
                    for candidate in lib.items(MatchQuery("mb_trackid", primary))
                    if candidate.id not in batch_ids
                ),
                None,
            )
        if existing is None:
            kept.append(item)
            continue
        protocol.log(
            f"enrich_album: item {item.id} duplicates library item {existing.id}, removing"
        )
        try:
            item.remove(delete=True)
        except Exception as exc:
            protocol.log(f"enrich_album: duplicate removal failed: {exc}")
        duplicates[item.id] = existing.id
        protocol.send_event(
            request_id, "enrich_progress", {"stage": "track_done", "item_id": item.id}
        )
    return kept, duplicates


def _apply_album(request_id: str, lib, match, pause: float, source: str | None, hints: dict):
    """Apply the match to its mapped items. Returns (album, mapped_items).

    Covers and reports are left to the caller, since adopted bonus tracks join
    the album afterwards. `source` ("acoustid" or "text") is recorded on each
    item; `hints` feeds the suspect-match check."""
    protocol.send_event(request_id, "enrich_progress", {"stage": "apply"})
    match.apply_metadata()
    mapped = match.items

    # Items were imported as singletons, so build one album row. Reuse a row for
    # the same release, or failing that the same name: the UI groups by name, and
    # a sibling row would split the folder (%aunique suffix).
    album = enrich.find_album_row(lib, match.info.album_id)
    foreign = False
    if album is None:
        album = enrich.find_named_row(
            lib, mapped[0].albumartist if mapped else None, mapped[0].album if mapped else None
        )
        # Another edition's row: share its folder, keep its own tags and artwork.
        foreign = album is not None and bool(album.mb_albumid)
    if album is not None:
        protocol.log(f"enrich_album: joining existing album row {album.id}")
        for item in mapped:
            item.album_id = album.id
    else:
        album = lib.add_album(mapped)
    if not foreign:
        match.apply_album_metadata(album)
    album.store()

    lastgenre = metadata.lastgenre_plugin()
    total = len(mapped)
    for done, item in enumerate(mapped, start=1):
        protocol.send_event(request_id, "enrich_progress", {"stage": "apply", "item_id": item.id})
        # Only genre-less items reach Last.fm, so only those are paced.
        had_genre = bool(item.get("genres", with_album=False))
        genres, label = lastgenre._get_genre(item)
        if genres:
            item.genres = genres
            protocol.log(f"enrich_album: genre {genres} ({label})")
        if source:
            provenance.mark_match(item, source)
        provisional.clear(item)
        if suspect.mark(item, (hints.get(item.id) or {}).get("title")):
            protocol.log(
                f"enrich_album: item {item.id} flagged {suspect.TITLE_MISMATCH}: "
                f"« {(hints.get(item.id) or {}).get('title')} » matched « {item.title} »"
            )
        item.store()
        try:
            item.write()
        except Exception as exc:  # DB is authoritative; file tags are best-effort
            protocol.log(f"enrich_album: tag write failed: {exc}")
        try:
            item.move()
        except Exception as exc:
            protocol.log(f"enrich_album: move failed: {exc}")
        if not had_genre and pause > 0 and done < total:
            time.sleep(pause)
        protocol.send_event(
            request_id,
            "enrich_progress",
            {"stage": "track_done", "done": done, "total": total, "item_id": item.id},
        )

    return album, mapped, foreign


def _adopt_bonus_tracks(
    request_id: str, lib, album, match, leftovers, recordings: dict, pause: float, hints: dict
) -> list:
    """Adopt leftovers found on a sibling edition of the release-group (deluxe,
    regional): track metadata from their edition, album identity from the main
    one, numbered after the last slot. Returns the adopted items."""
    group_id = match.info.releasegroup_id
    if not group_id:
        return []
    plugin = metadata.mb_plugin()

    candidates: dict[
        int, dict[str, tuple[dict, str]]
    ] = {}  # item_id -> {release_id: (release, rec_id)}
    by_item = {item.id: item for item in leftovers}
    for item in leftovers:
        found: dict[str, tuple[dict, str]] = {}
        for rec_id in recordings.get(item.id) or []:
            try:
                rec = plugin.mb_api.get_recording(rec_id, includes=["releases", "release-groups"])
            except Exception as exc:
                protocol.log(f"enrich_album: recording {rec_id} failed: {exc}")
                continue
            for release in rec.get("releases", []) if isinstance(rec, dict) else []:
                rg = release.get("release_group") or {}
                if release.get("id") and rg.get("id") == group_id:
                    found.setdefault(release["id"], (release, rec_id))
        if found:
            candidates[item.id] = found

    # Greedy: fewest editions covering the most leftovers.
    assignments: dict[str, list[tuple]] = {}  # release_id -> [(item, rec_id)]
    pending = set(candidates)
    while pending:
        counts: dict[str, dict] = {}
        for item_id in pending:
            for release_id, (release, _) in candidates[item_id].items():
                counts.setdefault(release_id, {"n": 0, "release": release})
                counts[release_id]["n"] += 1
        best = sorted(
            counts,
            key=lambda rid: (-counts[rid]["n"], metadata.release_rank(counts[rid]["release"])),
        )[0]
        for item_id in sorted(pending):
            if best in candidates[item_id]:
                _, rec_id = candidates[item_id][best]
                assignments.setdefault(best, []).append((by_item[item_id], rec_id))
                pending.discard(item_id)

    adopted: list = []
    lastgenre = metadata.lastgenre_plugin()
    next_track = len(match.info.tracks)
    for release_id, pairs in assignments.items():
        try:
            info = plugin.album_for_id(release_id)
        except Exception as exc:
            protocol.log(f"enrich_album: sibling release {release_id} failed: {exc}")
            info = None
        if info is None:
            continue
        tracks_by_id = {t.track_id: t for t in info.tracks}
        protocol.log(f"enrich_album: adopting {len(pairs)} bonus track(s) from {info.album}")
        pairs.sort(key=lambda p: tracks_by_id[p[1]].index or 0)
        for item, rec_id in pairs:
            track = tracks_by_id.get(rec_id)
            if track is None:
                continue
            next_track += 1
            # Track fields from the bonus edition, album fields from the main release.
            item.update(enrich.work_fields(track.merge_with_album(match.info)))
            item.track = next_track
            item.album_id = album.id
            item["sonarche_bonus_source"] = info.album
            genres, label = lastgenre._get_genre(item)
            if genres:
                item.genres = genres
                protocol.log(f"enrich_album: genre {genres} ({label})")
            provenance.mark_match(item, "acoustid")
            provisional.clear(item)
            suspect.mark(item, (hints.get(item.id) or {}).get("title"))
            item.store()
            try:
                item.write()
            except Exception as exc:
                protocol.log(f"enrich_album: tag write failed: {exc}")
            try:
                item.move()
            except Exception as exc:
                protocol.log(f"enrich_album: move failed: {exc}")
            protocol.send_event(
                request_id, "enrich_progress", {"stage": "track_done", "item_id": item.id}
            )
            adopted.append(item)
    return adopted


def _build_reports(lib, items) -> list[dict]:
    reports = []
    for item in items:
        fresh = lib.get_item(item.id)
        reports.append({"item_id": item.id, "report": build_report(fresh) if fresh else None})
    return reports


def _handle_forced(
    request_id: str,
    lib,
    items,
    params: dict,
    pause: float,
    forced: dict,
    duplicate_reports: list,
    recordings: dict,
) -> dict:
    """User-named album: identify tracks individually, then file them under it.

    The provisional fill runs first because it zeroes `track`; forcing the album
    afterwards restores the playlist position."""
    protocol.log(f"enrich_album: album forced to « {forced['title']} », per-track identification")
    any_matched = enrich_per_track(request_id, lib, items, params, pause, recordings)
    # The forced apply re-files everything anyway.
    tag_unidentified(lib, None, items, params, file=False)

    fresh = [item for item in (lib.get_item(i.id) for i in items) if item is not None]
    album = forced_album.apply(lib, fresh, forced)
    provisional_cover = forced_album.ensure_cover(lib, album, fresh, forced)

    return {
        "matched": any_matched,
        "mode": "forced",
        "provisional_cover": provisional_cover,
        "reports": _build_reports(lib, fresh) + duplicate_reports,
    }


def handle(request_id: str, params: dict) -> dict:
    from beets.library import Library

    lib = Library(params["beets_db"], directory=params["library_dir"])
    items = []
    seen: set[int] = set()
    for item_id in params["item_ids"]:
        if item_id in seen:  # defensive: a duplicated id would wreck the mapping
            continue
        seen.add(item_id)
        item = lib.get_item(item_id)
        if item is None:
            raise RuntimeError(f"item not found: {item_id}")
        items.append(item)
    if not items:
        raise RuntimeError("no items to enrich")

    metadata.ensure_plugins()
    pause = max(0.0, float(params.get("fetch_pause_seconds", _DEFAULT_FETCH_PAUSE_SECONDS)))
    forced = forced_album.requested(params)

    duplicate_reports: list[dict] = []
    recordings: dict[int, list[str]] = {}
    if params.get("acoustid_key"):
        recordings = _fingerprint_all(request_id, items, params)
        items, duplicates = _remove_duplicates(request_id, lib, items, recordings)
        # A forced album may legitimately contain tracks already owned elsewhere.
        if not forced:
            items, library_duplicates = _remove_library_duplicates(
                request_id, lib, items, recordings
            )
            duplicates.update(library_duplicates)
        duplicate_reports = [
            {"item_id": item_id, "duplicate_of": kept_id, "report": None}
            for item_id, kept_id in sorted(duplicates.items())
        ]
        if not items:
            return {"matched": False, "mode": "none", "reports": duplicate_reports}
    else:
        protocol.log("enrich_album: no AcoustID key configured, text search only")

    hints = {h["item_id"]: h for h in params.get("track_hints") or []}
    _apply_hints(items, hints, params.get("artist"))

    if forced:
        return _handle_forced(
            request_id, lib, items, params, pause, forced, duplicate_reports, recordings
        )

    match, leftovers = None, []
    source = None
    if recordings:
        protocol.send_event(request_id, "enrich_progress", {"stage": "match"})
        release_id = vote_release_id(request_id, items, recordings, pause)
        if release_id:
            protocol.log(f"enrich_album: fingerprints voted release {release_id}")
            match, leftovers = build_match(items, recordings, release_id)
            source = "acoustid"
        if match is not None and leftovers:
            match, leftovers = rescue_coverage(request_id, items, recordings, match, leftovers)
        if match is not None and leftovers:
            leftovers = rescue_slots(match, leftovers, hints)
    if match is None:
        match, leftovers = text_album_match(request_id, items, params), []
        source = "text" if match is not None else None

    single_album = bool(params.get("single_album"))
    if match is not None:
        album, mapped, foreign = _apply_album(request_id, lib, match, pause, source, hints)
        adopted = (
            _adopt_bonus_tracks(request_id, lib, album, match, leftovers, recordings, pause, hints)
            if leftovers
            else []
        )
        artpath = enrich._decode(album.artpath) if album.artpath else None
        if foreign and artpath and os.path.exists(artpath):
            # Borrow the existing cover rather than fetching over it.
            for item in mapped + adopted:
                embed_album_cover(album, item)
        else:
            fetch_album_cover(
                album, mapped + adopted, match.info.album_id, match.info.releasegroup_id
            )
        rest = [i for i in leftovers if i.id not in {a.id for a in adopted}]
        if rest:
            protocol.log(f"enrich_album: {len(rest)} leftover track(s), per-track fallback")
            enrich_per_track(request_id, lib, rest, params, pause, recordings)
            if single_album:
                absorb_strays(request_id, lib, album, rest)
        finalize_fallback(lib, mapped + adopted + rest)
        if rest:
            tag_unidentified(lib, album, rest, params)
        reports = _build_reports(lib, mapped + adopted + rest) + duplicate_reports
        return {"matched": True, "mode": "album", "reports": reports}

    if single_album:
        # No coherent release: treat the playlist as a forced album.
        fallback = single_album_fallback(params)
        if fallback is not None:
            protocol.log(
                f"enrich_album: no album-level match, single-album groups the "
                f"playlist as « {fallback['title']} »"
            )
            return _handle_forced(
                request_id, lib, items, params, pause, fallback, duplicate_reports, recordings
            )

    protocol.log("enrich_album: no album-level match, falling back per track")
    any_matched = enrich_per_track(request_id, lib, items, params, pause, recordings)
    finalize_fallback(lib, items)
    tag_unidentified(lib, None, items, params)
    return {
        "matched": any_matched,
        "mode": "per_track" if any_matched else "none",
        "reports": _build_reports(lib, items) + duplicate_reports,
    }
