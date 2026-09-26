"""When no release fits the whole album: per-track enrichment, strays and
unidentified files."""

import os
import time

import enrich
import forced_album
import protocol
from album_rows import consolidate_album_rows, embed_album_cover, fetch_album_cover


def enrich_per_track(
    request_id: str, lib, items, params: dict, pause: float, recordings: dict | None = None
) -> bool:
    """Per-track enrichment loop, for the full batch or an album's leftovers.

    Covers are fetched once per album in `finalize_fallback`. `recordings`
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


def finalize_fallback(lib, items) -> None:
    """Regroup same-release rows, then fetch still-missing covers."""
    for album in consolidate_album_rows(lib, items):
        artpath = enrich._decode(album.artpath) if album.artpath else None
        if artpath and os.path.exists(artpath):
            continue
        fetch_album_cover(album, list(album.items()), album.mb_albumid, album.mb_releasegroupid)


def absorb_strays(request_id: str, lib, album, items) -> list:
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
            f"enrich_album: absorbing item {fresh.id} from « {origin_title} » as track {next_track}"
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
        embed_album_cover(album, fresh)
        protocol.send_event(
            request_id, "enrich_progress", {"stage": "track_done", "item_id": fresh.id}
        )
        absorbed.append(fresh)
    return absorbed


def single_album_fallback(params: dict) -> dict | None:
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


def tag_unidentified(lib, album, items, params: dict, file: bool = True) -> None:
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
            embed_album_cover(album, fresh)
