"""Enrich a whole album's items against one MusicBrainz release.

Per-track enrichment matches each file independently, so an OST/compilation
can scatter across different releases (inconsistent album names, N cover
fetches). Here the release identity is decided once — fingerprint a sample of
tracks, vote for the release they share — then beets' album autotagger maps
every item to its track on that release. Per-track enrichment remains as the
fallback when no coherent release emerges."""

import os
import time

import enrich
import metadata
import protocol
from report import build_report

# Sampled tracks are enough to identify the release; each costs one fpcalc run,
# one AcoustID lookup and a few MusicBrainz calls.
_MAX_SAMPLES = 3
# The release identity comes from fingerprints, so the textual distance check
# can stay loose — it only guards the item->track mapping.
_MAX_ALBUM_DISTANCE = 0.4
# The text search has no fingerprint safety net: near-perfect hits only.
_MAX_TEXT_ALBUM_DISTANCE = 0.15

_DEFAULT_FETCH_PAUSE_SECONDS = 1.0


def vote_release(release_sets: list[list[dict]], track_count: int) -> str | None:
    """Pick the release id best supported by the sampled fingerprints. Pure.

    `release_sets` holds one list of MB release dicts per sampled track.
    Releases backed by more samples win; ties break on exact track count
    (when the lookup carried one), then on release_rank (studio album over
    compilation, earliest date).
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
        # Key name depends on the MB client's normalization; tolerate both.
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


def _apply_hints(items, hints: dict, artist: str | None) -> None:
    """In-memory only, never stored: without title/track hints the mapping
    distance on empty tags degrades assign_items badly."""
    for item in items:
        hint = hints.get(item.id) or {}
        if hint.get("title"):
            item.title = hint["title"]
        if artist:
            item.artist = artist
        if hint.get("index"):
            item.track = int(hint["index"])


def _vote_from_fingerprints(request_id: str, items, params: dict, pause: float) -> str | None:
    plugin = metadata.mb_plugin()
    n = len(items)
    positions = sorted({0, n // 2, n - 1})[:_MAX_SAMPLES]
    total = len(positions)
    release_sets: list[list[dict]] = []
    for done, pos in enumerate(positions):
        item = items[pos]
        path = enrich._decode_path(item)
        if not os.path.exists(path):
            continue
        protocol.send_event(
            request_id, "enrich_progress", {"stage": "fingerprint", "done": done, "total": total}
        )
        try:
            duration, fingerprint = enrich._fingerprint(params["fpcalc"], path)
            protocol.send_event(
                request_id, "enrich_progress", {"stage": "lookup", "done": done, "total": total}
            )
            recordings = enrich._lookup_recordings(params["acoustid_key"], fingerprint, duration)
        except Exception as exc:  # one bad sample must not sink the vote
            protocol.log(f"enrich_album: sample {pos} fingerprint failed: {exc}")
            recordings = []
        releases: list[dict] = []
        for rec_id in recordings:
            try:
                # MusicBrainz pacing is handled by beets' client (~1 req/s).
                rec = plugin.mb_api.get_recording(rec_id, includes=["releases", "release-groups"])
                releases.extend(rec.get("releases", []) if isinstance(rec, dict) else [])
            except Exception as exc:
                protocol.log(f"enrich_album: recording {rec_id} failed: {exc}")
        if releases:
            release_sets.append(releases)
        # AcoustID has no strict limit but shares fate with every beets user;
        # pace the batch the same way the genre recompute does.
        if pause > 0 and done < total - 1:
            time.sleep(pause)
    return vote_release(release_sets, n)


def _find_album_match(request_id: str, items, params: dict, pause: float):
    from beets import autotag

    track_count = len(items)
    release_id = None
    if params.get("acoustid_key"):
        release_id = _vote_from_fingerprints(request_id, items, params, pause)
    else:
        protocol.log("enrich_album: no AcoustID key configured, text search only")

    _apply_hints(items, {h["item_id"]: h for h in params.get("track_hints") or []},
                 params.get("artist"))

    if release_id:
        protocol.send_event(request_id, "enrich_progress", {"stage": "match"})
        protocol.log(f"enrich_album: fingerprints voted release {release_id}")
        _, _, proposal = autotag.tag_album(items, search_ids=[release_id])
        for match in proposal.candidates[:1]:
            if not match.extra_items and float(match.distance) <= _MAX_ALBUM_DISTANCE:
                return match
            protocol.log(
                f"enrich_album: voted release rejected "
                f"(distance {float(match.distance):.3f}, {len(match.extra_items)} unmapped)"
            )

    album_title = params.get("album_title")
    artist = params.get("artist")
    if album_title or artist:
        protocol.send_event(request_id, "enrich_progress", {"stage": "match"})
        _, _, proposal = autotag.tag_album(
            items, search_artist=artist, search_name=album_title
        )
        for match in proposal.candidates[:1]:
            if (
                not match.extra_items
                and len(match.info.tracks) == track_count
                and float(match.distance) <= _MAX_TEXT_ALBUM_DISTANCE
            ):
                return match
    return None


def _apply_album(request_id: str, lib, items, match, pause: float) -> list[dict]:
    protocol.send_event(request_id, "enrich_progress", {"stage": "apply"})
    match.apply_metadata()
    mapped = match.items  # extra_items is empty here, so this is all of them

    # One real album row for the set (items were imported as singletons), built
    # from the now-populated item fields — the single-track path syncs a blank
    # row for the same reason: destination paths and duplicate detection read
    # album-level fields from the row, not the items.
    album = lib.add_album(mapped)
    match.apply_album_metadata(album)
    album.store()

    lastgenre = metadata.lastgenre_plugin()
    total = len(mapped)
    for done, item in enumerate(mapped, start=1):
        # Same policy as enrich/genres: MB genres canonicalize offline; only a
        # genre-less item reaches Last.fm, and only those pace the loop.
        had_genre = bool(item.get("genres", with_album=False))
        genres, label = lastgenre._get_genre(item)
        if genres:
            item.genres = genres
            protocol.log(f"enrich_album: genre {genres} ({label})")
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
            request_id, "enrich_progress", {"stage": "apply", "done": done, "total": total}
        )

    # One cover fetch for the whole album, embedded into every file.
    try:
        cover = enrich.download_cover(match.info.album_id)
        if cover is not None:
            data, is_png = cover
            enrich.set_album_art(album, data, is_png)
            for item in mapped:
                enrich.embed_cover(item, data, is_png)
    except Exception as exc:  # metadata landed; a missing cover is not a failure
        protocol.log(f"enrich_album: cover fetch failed: {exc}")

    reports = []
    for item in mapped:
        fresh = lib.get_item(item.id)
        reports.append({"item_id": item.id, "report": build_report(fresh) if fresh else None})
    return reports


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

    match = _find_album_match(request_id, items, params, pause)
    if match is not None:
        reports = _apply_album(request_id, lib, items, match, pause)
        return {"matched": True, "mode": "album", "reports": reports}

    protocol.log("enrich_album: no album-level match, falling back per track")
    hints = {h["item_id"]: h for h in params.get("track_hints") or []}
    reports = []
    any_matched = False
    total = len(items)
    for done, item in enumerate(items, start=1):
        hint = hints.get(item.id) or {}
        track_params = {**params, "title": hint.get("title"), "artist": params.get("artist")}
        try:
            result = enrich.enrich_one(request_id, lib, item, track_params)
        except Exception as exc:  # one bad track must not sink the rest
            protocol.log(f"enrich_album: item {item.id} enrich failed: {exc}")
            result = {"matched": False, "report": None}
        any_matched = any_matched or bool(result.get("matched"))
        reports.append({"item_id": item.id, "report": result.get("report")})
        if pause > 0 and done < total:
            time.sleep(pause)

    return {
        "matched": any_matched,
        "mode": "per_track" if any_matched else "none",
        "reports": reports,
    }
