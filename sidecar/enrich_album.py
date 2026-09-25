"""Enrich a whole album's items against one MusicBrainz release.

Every file is fingerprinted, a release is voted from sampled recordings, and
items map to tracks by recording id (duration rescues unidentified files).
In-batch duplicates are dropped and bonus tracks from sibling editions are
adopted. Per-track enrichment is the fallback when no release emerges.
"""

import os
import time

import covers
import enrich
import forced_album
import metadata
import protocol
import provenance
import provisional
import suspect
from report import build_report

# Each sample costs a few MusicBrainz calls (~1 req/s).
_MAX_SAMPLES = 3
# Tolerates trims/silence; a wrong mapping is usually a different song.
_MAX_DURATION_DIFF_SECONDS = 20.0
# No fingerprint safety net for text search: near-perfect hits only.
_MAX_TEXT_ALBUM_DISTANCE = 0.15

_DEFAULT_FETCH_PAUSE_SECONDS = 1.0
# AcoustID allows 3 req/s per key.
_DEFAULT_LOOKUP_PAUSE_SECONDS = 0.5


def vote_release(release_sets: list[list[dict]], track_count: int) -> str | None:
    """Pick the release id best supported by the sampled fingerprints.

    `release_sets` holds one list of MB releases per sampled track. Ties break
    on exact track count, then `release_rank`.
    """
    votes: dict[str, int] = {}
    by_id: dict[str, dict] = {}
    for releases in release_sets:
        seen = set()
        for release in releases:
            release_id = release.get("id")
            if not release_id or release_id in seen:
                continue
            seen.add(release_id)
            votes[release_id] = votes.get(release_id, 0) + 1
            by_id.setdefault(release_id, release)
    if not votes:
        return None

    def _track_count(release: dict) -> int | None:
        # The key name depends on the MB client's normalization.
        for key in ("track-count", "track_count", "medium-track-count"):
            value = release.get(key)
            if isinstance(value, int):
                return value
        return None

    def _key(release_id: str):
        release = by_id[release_id]
        return (
            -votes[release_id],
            0 if _track_count(release) == track_count else 1,
            metadata.release_rank(release),
        )

    return sorted(votes, key=_key)[0]


def rescue_candidates(release_sets: list[list[dict]], exclude: str | None = None) -> list[str]:
    """Alternative releases for leftovers the voted release doesn't cover,
    ranked by how many leftovers each could host. `exclude` is never returned."""
    votes: dict[str, int] = {}
    by_id: dict[str, dict] = {}
    for releases in release_sets:
        seen = set()
        for release in releases:
            release_id = release.get("id")
            if not release_id or release_id == exclude or release_id in seen:
                continue
            seen.add(release_id)
            votes[release_id] = votes.get(release_id, 0) + 1
            by_id.setdefault(release_id, release)
    return sorted(votes, key=lambda rid: (-votes[rid], metadata.release_rank(by_id[rid])))


def slot_rescues(leftovers, tracks, hints: dict) -> dict:
    """Seat leftovers onto the voted release's empty tracks when both the video
    title and the duration agree. Returns {item: track}, nearest duration wins.

    Leftovers were fingerprinted to a sibling edition's recording (e.g. another
    language), so neither signal is trusted alone; title agreement without both
    lengths seats nothing."""
    assignments: dict = {}
    taken: set[int] = set()
    for item in leftovers:
        hint = (hints.get(item.id) or {}).get("title")
        file_length = float(item.length) if item.length else None
        if not hint or not file_length:
            continue
        best = None
        for track in tracks:
            if id(track) in taken or not track.length:
                continue
            if not suspect.titles_agree(hint, track.title):
                continue
            diff = abs(file_length - float(track.length))
            if diff <= _MAX_DURATION_DIFF_SECONDS and (best is None or diff < best[0]):
                best = (diff, track)
        if best is not None:
            assignments[item] = best[1]
            taken.add(id(best[1]))
    return assignments


def find_content_duplicates(recording_lists: list[tuple[int, list[str]]]) -> dict[int, int]:
    """{duplicate item id: kept item id} for items sharing the same primary
    AcoustID recording. First occurrence wins.

    Only the primary recording counts: secondary matches are often mislinked
    and can be shared by genuinely different tracks."""
    kept: dict[str, int] = {}  # primary recording id -> first item that had it
    duplicates: dict[int, int] = {}
    for item_id, recordings in recording_lists:
        primary = recordings[0] if recordings else None
        if primary is None:
            continue
        if primary in kept:
            duplicates[item_id] = kept[primary]
        else:
            kept[primary] = item_id
    return duplicates


def match_by_recordings(items, tracks, recordings_by_item: dict) -> tuple[dict, list, list]:
    """Map items to release tracks. Returns (mapping, leftover_items, extra_tracks).

    1. Recording id match.
    2. Nearest duration, only for items AcoustID could not identify.
    3. A lone leftover takes a lone empty slot."""
    mapping: dict = {}
    remaining = list(tracks)
    silent, leftovers = [], []
    for item in items:
        recordings = set(recordings_by_item.get(item.id) or ())
        if not recordings:
            silent.append(item)
            continue
        track = next((t for t in remaining if t.track_id in recordings), None)
        if track is not None:
            mapping[item] = track
            remaining.remove(track)
        else:
            leftovers.append(item)
    for item in silent:
        file_length = float(item.length) if item.length else None
        best = None
        for track in remaining:
            if not file_length or not track.length:
                continue
            diff = abs(file_length - track.length)
            if diff <= _MAX_DURATION_DIFF_SECONDS and (best is None or diff < best[0]):
                best = (diff, track)
        if best is not None:
            mapping[item] = best[1]
            remaining.remove(best[1])
        else:
            leftovers.append(item)

    # Elimination: covers video rips that resolve to the single's recording and
    # run long. The majority guard keeps genuine bonus tracks out of free slots.
    if len(leftovers) == 1 and len(remaining) == 1 and len(mapping) > len(items) / 2:
        mapping[leftovers[0]] = remaining[0]
        leftovers, remaining = [], []

    return mapping, leftovers, remaining


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
        protocol.log(
            f"enrich_album: fingerprint {done + 1}/{total}: {os.path.basename(path)}"
        )
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
            protocol.log(
                f"enrich_album: fingerprint ok ({len(recordings[item.id])} recording(s))"
            )
        except Exception as exc:
            protocol.log(f"enrich_album: item {item.id} fingerprint failed: {exc}")
            recordings[item.id] = []
        if lookup_pause > 0 and done < total - 1:
            time.sleep(lookup_pause)
    return recordings


def _remove_duplicates(request_id: str, lib, items, recordings: dict) -> tuple[list, dict[int, int]]:
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


def _remove_library_duplicates(request_id: str, lib, items, recordings: dict) -> tuple[list, dict[int, int]]:
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


def _vote_release_id(request_id: str, items, recordings: dict, pause: float) -> str | None:
    """Vote among the releases of a few identified items, spread across the batch."""
    plugin = metadata.mb_plugin()
    known = [item for item in items if recordings.get(item.id)]
    if not known:
        return None
    n = len(known)
    positions = sorted({0, n // 2, n - 1})[:_MAX_SAMPLES]
    release_sets: list[list[dict]] = []
    total = len(positions)
    for done, pos in enumerate(positions):
        item = known[pos]
        releases: list[dict] = []
        for rec_id in recordings[item.id]:
            try:
                # beets' client paces MusicBrainz (~1 req/s).
                rec = plugin.mb_api.get_recording(rec_id, includes=["releases", "release-groups"])
                releases.extend(rec.get("releases", []) if isinstance(rec, dict) else [])
            except Exception as exc:
                protocol.log(f"enrich_album: recording {rec_id} failed: {exc}")
        if releases:
            release_sets.append(releases)
        if pause > 0 and done < total - 1:
            time.sleep(pause)
    return vote_release(release_sets, len(items))


def _build_match(items, recordings: dict, release_id: str):
    """(AlbumMatch, leftovers) on the voted release, or (None, items) unless a
    majority of the files map onto it."""
    from beets.autotag.distance import Distance
    from beets.autotag.match import AlbumMatch

    album_info = metadata.mb_plugin().album_for_id(release_id)
    if album_info is None:
        return None, list(items)
    mapping, leftovers, extra_tracks = match_by_recordings(items, album_info.tracks, recordings)
    if len(mapping) <= len(items) / 2:
        protocol.log(
            f"enrich_album: voted release rejected (only {len(mapping)} of "
            f"{len(items)} tracks map onto it)"
        )
        return None, list(items)
    protocol.log(
        f"enrich_album: mapped {len(mapping)}/{len(items)} track(s) onto "
        f"« {album_info.album} » by recording id"
    )
    if leftovers:
        protocol.log(
            f"enrich_album: {len(leftovers)} track(s) off the voted release"
        )
    match = AlbumMatch(
        distance=Distance(),
        info=album_info,
        mapping=mapping,
        extra_items=list(leftovers),
        extra_tracks=extra_tracks,
    )
    return match, leftovers


# Rescue budget: releases re-tested, and recordings resolved per leftover.
_MAX_RESCUE_RELEASES = 2
_MAX_RESCUE_RECORDINGS = 3


def _rescue_coverage(request_id: str, items, recordings: dict, match, leftovers):
    """Switch to a leftover's own release when it maps strictly more files.

    The vote ranks by AcoustID popularity, which is wrong when two editions
    share fingerprints; identified files that don't fit the voted release are
    the tell."""
    plugin = metadata.mb_plugin()
    release_sets: list[list[dict]] = []
    for item in leftovers:
        releases: list[dict] = []
        for rec_id in (recordings.get(item.id) or [])[:_MAX_RESCUE_RECORDINGS]:
            try:
                rec = plugin.mb_api.get_recording(rec_id, includes=["releases", "release-groups"])
                releases.extend(rec.get("releases", []) if isinstance(rec, dict) else [])
            except Exception as exc:
                protocol.log(f"enrich_album: recording {rec_id} failed: {exc}")
        if releases:
            release_sets.append(releases)

    for release_id in rescue_candidates(release_sets, exclude=match.info.album_id)[:_MAX_RESCUE_RELEASES]:
        candidate, candidate_leftovers = _build_match(items, recordings, release_id)
        if candidate is None:
            continue
        if len(candidate.mapping) > len(match.mapping):
            protocol.log(
                f"enrich_album: « {candidate.info.album} » covers "
                f"{len(candidate.mapping)}/{len(items)} file(s) against "
                f"{len(match.mapping)} on the voted release — switching"
            )
            return candidate, candidate_leftovers
    return match, leftovers


def _rescue_slots(match, leftovers, hints: dict) -> list:
    """Apply `slot_rescues` to the match in place. Returns unseated leftovers."""
    rescued = slot_rescues(leftovers, match.extra_tracks, hints)
    for item, track in rescued.items():
        protocol.log(
            f"enrich_album: item {item.id} seated on open slot {track.index} "
            f"« {track.title} » by title+duration"
        )
        match.mapping[item] = track
        match.extra_tracks.remove(track)
        if item in match.extra_items:
            match.extra_items.remove(item)
    return [item for item in leftovers if item not in rescued]


def _text_album_match(request_id: str, items, params: dict):
    """Text search fallback: only a complete, near-perfect match is trusted."""
    from beets import autotag

    album_title = params.get("album_title")
    artist = params.get("artist")
    if not (album_title or artist):
        return None
    protocol.send_event(request_id, "enrich_progress", {"stage": "match"})
    _, _, proposal = autotag.tag_album(items, search_artist=artist, search_name=album_title)
    for match in proposal.candidates[:1]:
        if (
            not match.extra_items
            and len(match.info.tracks) == len(items)
            and float(match.distance) <= _MAX_TEXT_ALBUM_DISTANCE
        ):
            return match
    return None


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
        protocol.send_event(
            request_id, "enrich_progress", {"stage": "apply", "item_id": item.id}
        )
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


def _adopt_bonus_tracks(request_id: str, lib, album, match, leftovers, recordings: dict, pause: float, hints: dict) -> list:
    """Adopt leftovers found on a sibling edition of the release-group (deluxe,
    regional): track metadata from their edition, album identity from the main
    one, numbered after the last slot. Returns the adopted items."""
    group_id = match.info.releasegroup_id
    if not group_id:
        return []
    plugin = metadata.mb_plugin()

    candidates: dict[int, dict[str, tuple[dict, str]]] = {}  # item_id -> {release_id: (release, rec_id)}
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
            counts, key=lambda rid: (-counts[rid]["n"], metadata.release_rank(counts[rid]["release"]))
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


def _fetch_album_cover(
    album, items, release_id: str | None, release_group_id: str | None = None
) -> None:
    if not release_id:
        return
    try:
        protocol.log(f"enrich_album: fetching cover for release {release_id}")
        cover = enrich.download_cover(release_id, release_group_id)
        if cover is not None:
            enrich.set_album_art(album, *cover)
            for item in items:
                enrich.embed_cover(item, *cover)
            protocol.log(f"enrich_album: cover stored (500px embedded in {len(items)} file(s))")
    except Exception as exc:  # metadata landed; a missing cover is not a failure
        protocol.log(f"enrich_album: cover fetch failed: {exc}")


def _build_reports(lib, items) -> list[dict]:
    reports = []
    for item in items:
        fresh = lib.get_item(item.id)
        reports.append({"item_id": item.id, "report": build_report(fresh) if fresh else None})
    return reports


def _adopt_art(keep, dying) -> None:
    """Move a dying row's covers into the kept row's folder if it has none,
    otherwise delete them so the emptied folder can be pruned."""
    import shutil

    art = enrich._decode(dying.artpath) if dying.artpath else None
    if not art or not os.path.exists(art):
        return
    src_dir = os.path.dirname(art)
    covers = [art] + [
        os.path.join(src_dir, name)
        for name in os.listdir(src_dir)
        if name.startswith("cover-hq.")
    ]
    keep_art = enrich._decode(keep.artpath) if keep.artpath else None
    if keep_art and os.path.exists(keep_art):
        for path in covers:
            try:
                os.remove(path)
            except OSError as exc:
                protocol.log(f"enrich_album: stale cover removal failed: {exc}")
    else:
        dest_dir = enrich._decode(keep.item_dir())
        for path in covers:
            try:
                shutil.move(path, os.path.join(dest_dir, os.path.basename(path)))
            except OSError as exc:
                protocol.log(f"enrich_album: cover relocation failed: {exc}")
        keep.artpath = os.path.join(dest_dir, os.path.basename(art))
        keep["art_source"] = dying.get("art_source") or keep.get("art_source")
        keep.store()
    try:
        if not os.listdir(src_dir):
            os.rmdir(src_dir)
    except OSError:
        pass


def _merge_rows(lib, rows, label: str):
    """Merge sibling album rows into the fullest one and re-move its files.
    With a single row, the re-move only drops a stale %aunique suffix."""
    members = {row.id: list(row.items()) for row in rows}
    keep = max(rows, key=lambda row: (len(members[row.id]), -row.id))
    for row in rows:
        if row.id == keep.id:
            continue
        protocol.log(f"enrich_album: merging album row {row.id} into {keep.id} ({label})")
        for item in members[row.id]:
            item.album_id = keep.id
            item.store()
            members[keep.id].append(item)
        _adopt_art(keep, row)
        row.remove(delete=False, with_items=False)
    # %aunique memoizes per Library; reset it now the dead rows are gone.
    lib._memotable = {}
    art_dir_before = (
        os.path.dirname(enrich._decode(keep.artpath)) if keep.artpath else None
    )
    for item in members[keep.id]:
        try:
            item.move()
        except Exception as exc:
            protocol.log(f"enrich_album: move failed: {exc}")
    # Item.move never touches artpath.
    if members[keep.id]:
        try:
            keep.move_art()
            keep.store()
        except Exception as exc:
            protocol.log(f"enrich_album: art move failed: {exc}")
    _prune_vacated_art_dir(lib, keep, art_dir_before)
    return keep


def _consolidate_album_rows(lib, items) -> list:
    """Keep one album row per MusicBrainz release and per album name.

    Sibling rows make %aunique suffix every folder while the UI, which groups by
    name, shows a single album. Collections and blank (provisional) names are
    left out."""
    import library as library_mod
    from beets.dbcore.query import AndQuery, MatchQuery

    def _fresh_rows():
        rows = {}
        for item in items:
            fresh = lib.get_item(item.id)
            if fresh is None or fresh.album_id is None:
                continue
            row = lib.get_album(fresh.album_id)
            if row is not None:
                rows[row.id] = row
        return list(rows.values())

    albums: dict[int, object] = {}
    touched_releases = {
        str(row.mb_albumid) for row in _fresh_rows() if row.mb_albumid
    }
    for release_id in touched_releases:
        rows = list(lib.albums(MatchQuery("mb_albumid", release_id)))
        if rows:
            keep = _merge_rows(lib, rows, release_id)
            albums[keep.id] = keep

    # Names on the post-merge state: this pass crosses editions, the first doesn't.
    touched_names = {
        (str(row.albumartist), str(row.album))
        for row in _fresh_rows()
        if row.albumartist
        and row.album
        and row.get(library_mod.ALBUM_KIND_KEY) != library_mod.COLLECTION
    }
    for albumartist, album_title in touched_names:
        rows = [
            row
            for row in lib.albums(
                AndQuery(
                    [MatchQuery("albumartist", albumartist), MatchQuery("album", album_title)]
                )
            )
            if row.get(library_mod.ALBUM_KIND_KEY) != library_mod.COLLECTION
        ]
        if not rows:
            continue
        if len(rows) == 1 and rows[0].id in albums:
            # Already merged and re-moved by the release pass.
            continue
        keep = _merge_rows(lib, rows, f"{albumartist} — {album_title}")
        for row in rows:
            albums.pop(row.id, None)
        albums[keep.id] = keep
    return list(albums.values())


def _prune_vacated_art_dir(lib, album, old_dir: str | None) -> None:
    """After a folder rename, sweep legacy covers and drop the emptied folder."""
    fresh = lib.get_album(album.id) if album is not None else None
    art = enrich._decode(fresh.artpath) if fresh is not None and fresh.artpath else None
    new_dir = os.path.dirname(art) if art else None
    if not old_dir or not new_dir or old_dir == new_dir or not os.path.isdir(old_dir):
        return
    covers.remove_legacy_archives(old_dir)
    try:
        if not os.listdir(old_dir):
            os.rmdir(old_dir)
    except OSError:
        pass


def _enrich_per_track(
    request_id: str, lib, items, params: dict, pause: float, recordings: dict | None = None
) -> bool:
    """Per-track enrichment loop, for the full batch or an album's leftovers.

    Covers are fetched once per album in `_finalize_fallback`. `recordings`
    reuses the batch's fingerprints to skip a second AcoustID round-trip."""
    hints = {h["item_id"]: h for h in params.get("track_hints") or []}
    any_matched = False
    total = len(items)
    for done, item in enumerate(items, start=1):
        hint = hints.get(item.id) or {}
        track_params = {**params, "title": hint.get("title"), "artist": params.get("artist")}
        try:
            # Cover and unidentified guess are deferred to the batch.
            result = enrich.enrich_one(
                request_id,
                lib,
                item,
                track_params,
                fetch_cover=False,
                provisional_fallback=False,
                known_recordings=(recordings or {}).get(item.id),
            )
        except Exception as exc:  # one bad track must not sink the rest
            protocol.log(f"enrich_album: item {item.id} enrich failed: {exc}")
            result = {"matched": False}
        any_matched = any_matched or bool(result.get("matched"))
        protocol.send_event(
            request_id,
            "enrich_progress",
            {"stage": "track_done", "done": done, "total": total, "item_id": item.id},
        )
        if pause > 0 and done < total:
            time.sleep(pause)
    return any_matched


def _finalize_fallback(lib, items) -> None:
    """Regroup same-release rows, then fetch still-missing covers."""
    for album in _consolidate_album_rows(lib, items):
        artpath = enrich._decode(album.artpath) if album.artpath else None
        if artpath and os.path.exists(artpath):
            continue
        _fetch_album_cover(
            album, list(album.items()), album.mb_albumid, album.mb_releasegroupid
        )


def _embed_album_cover(album, item) -> None:
    """Copy the album's existing cover onto a provisionally-tagged track."""
    if album is None or not album.artpath:
        return
    path = enrich._decode(album.artpath)
    if not os.path.exists(path):
        return
    try:
        with open(path, "rb") as f:
            data = f.read()
        enrich.embed_cover(item, data, data[:4] == b"\x89PNG")
    except Exception as exc:
        protocol.log(f"enrich_album: cover embed failed: {exc}")


def _absorb_strays(request_id: str, lib, album, items) -> list:
    """Single-album option: file leftovers identified on unrelated releases onto
    the batch album. Track-level tags are kept, album-level ids dropped, and the
    origin recorded in `sonarche_bonus_source`. Returns the absorbed items."""
    numbers = [int(resident.track or 0) for resident in album.items()]
    next_track = max(numbers, default=0)
    absorbed = []
    for item in items:
        fresh = lib.get_item(item.id)
        if fresh is None or fresh.album_id == album.id or not fresh.mb_trackid:
            continue
        origin_row = fresh.get_album()
        origin_title = (str(fresh.album) or "").strip()
        next_track += 1
        protocol.log(
            f"enrich_album: absorbing item {fresh.id} from « {origin_title} » "
            f"as track {next_track}"
        )
        fresh.album = album.album
        fresh.albumartist = album.albumartist
        fresh.comp = album.comp
        fresh.track = next_track
        fresh.tracktotal = 0
        fresh.mb_albumid = ""
        fresh.mb_releasegroupid = ""
        fresh.album_id = album.id
        if origin_title and origin_title != (str(album.album) or ""):
            fresh["sonarche_bonus_source"] = origin_title
        fresh.store()
        try:
            fresh.write()
        except Exception as exc:  # DB is authoritative; file tags are best-effort
            protocol.log(f"enrich_album: tag write failed: {exc}")
        try:
            fresh.move()
        except Exception as exc:
            protocol.log(f"enrich_album: move failed: {exc}")
        if origin_row is not None and origin_row.id != album.id and not list(origin_row.items()):
            enrich.drop_emptied_row(lib, origin_row)
        _embed_album_cover(album, fresh)
        protocol.send_event(
            request_id, "enrich_progress", {"stage": "track_done", "item_id": fresh.id}
        )
        absorbed.append(fresh)
    return absorbed


def _single_album_fallback(params: dict) -> dict | None:
    """Forced-album spec for the single-album option when no release emerges:
    the playlist itself, by its title. `None` without a title."""
    title = str(params.get("album_title") or "").strip()
    if not title:
        return None
    return {
        "title": title,
        "artist": forced_album.DEFAULT_ARTIST,
        "category": str(params.get("category") or ""),
        "thumbnail": str(params.get("thumbnail") or ""),
    }


def _tag_unidentified(lib, album, items, params: dict, file: bool = True) -> None:
    """Fill and flag items left unidentified by the per-track fallback.

    With an album row, borrow its release (album, artist, date, cover). Runs
    after consolidation so these guesses are never regrouped."""
    hints = {h["item_id"]: h for h in params.get("track_hints") or []}
    # The album's artist beats the uploader, unless it is "Various Artists".
    albumartist = str(album.albumartist) if album is not None else ""
    if albumartist == forced_album.DEFAULT_ARTIST:
        albumartist = ""
    artist = albumartist or params.get("artist")
    for item in items:
        fresh = lib.get_item(item.id)
        if fresh is None or fresh.mb_trackid:
            continue
        hint = hints.get(item.id) or {}
        track_params = {"title": hint.get("title"), "artist": artist}
        if enrich.apply_provisional(lib, fresh, track_params, album=album, file=file):
            _embed_album_cover(album, fresh)


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
    any_matched = _enrich_per_track(request_id, lib, items, params, pause, recordings)
    # The forced apply re-files everything anyway.
    _tag_unidentified(lib, None, items, params, file=False)

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
        release_id = _vote_release_id(request_id, items, recordings, pause)
        if release_id:
            protocol.log(f"enrich_album: fingerprints voted release {release_id}")
            match, leftovers = _build_match(items, recordings, release_id)
            source = "acoustid"
        if match is not None and leftovers:
            match, leftovers = _rescue_coverage(request_id, items, recordings, match, leftovers)
        if match is not None and leftovers:
            leftovers = _rescue_slots(match, leftovers, hints)
    if match is None:
        match, leftovers = _text_album_match(request_id, items, params), []
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
                _embed_album_cover(album, item)
        else:
            _fetch_album_cover(
                album, mapped + adopted, match.info.album_id, match.info.releasegroup_id
            )
        rest = [i for i in leftovers if i.id not in {a.id for a in adopted}]
        if rest:
            protocol.log(f"enrich_album: {len(rest)} leftover track(s), per-track fallback")
            _enrich_per_track(request_id, lib, rest, params, pause, recordings)
            if single_album:
                _absorb_strays(request_id, lib, album, rest)
        _finalize_fallback(lib, mapped + adopted + rest)
        if rest:
            _tag_unidentified(lib, album, rest, params)
        reports = _build_reports(lib, mapped + adopted + rest) + duplicate_reports
        return {"matched": True, "mode": "album", "reports": reports}

    if single_album:
        # No coherent release: treat the playlist as a forced album.
        fallback = _single_album_fallback(params)
        if fallback is not None:
            protocol.log(
                f"enrich_album: no album-level match, single-album groups the "
                f"playlist as « {fallback['title']} »"
            )
            return _handle_forced(
                request_id, lib, items, params, pause, fallback, duplicate_reports, recordings
            )

    protocol.log("enrich_album: no album-level match, falling back per track")
    any_matched = _enrich_per_track(request_id, lib, items, params, pause, recordings)
    _finalize_fallback(lib, items)
    _tag_unidentified(lib, None, items, params)
    return {
        "matched": any_matched,
        "mode": "per_track" if any_matched else "none",
        "reports": _build_reports(lib, items) + duplicate_reports,
    }
