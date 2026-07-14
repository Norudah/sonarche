"""Enrich an imported item with trusted metadata from its acoustic fingerprint.

fpcalc computes the Chromaprint locally (no network), AcoustID resolves it to
the exact MusicBrainz recording — this is what picks the studio version over
live/covers that plague text search — then the recording is expanded to its
canonical release for album, year, track number, genre and cover art. Text
search is only a conservative fallback, applied when it is near-certain."""

import json
import os
import subprocess
import tempfile

import metadata
import protocol
from report import build_report

_ACOUSTID_LOOKUP = "https://api.acoustid.org/v2/lookup"
# AcoustID answers with a confidence score; below this we trust nothing.
_MIN_SCORE = 0.6
# The text fallback has no fingerprint safety net: only apply near-perfect hits.
_MAX_TEXT_DISTANCE = 0.10
# Fingerprints occasionally map to several recordings; try the best few.
_MAX_RECORDINGS = 3


def _decode_path(item) -> str:
    path = item.path
    if isinstance(path, bytes):
        path = path.decode("utf-8", errors="replace")
    return path


def _fingerprint(fpcalc: str, path: str) -> tuple[int, str]:
    proc = subprocess.run(
        [fpcalc, "-json", path], capture_output=True, text=True, timeout=60
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"fpcalc failed (exit {proc.returncode}): {proc.stderr.strip()[:200]}"
        )
    data = json.loads(proc.stdout)
    return int(data["duration"]), data["fingerprint"]


def _lookup_recordings(api_key: str, fingerprint: str, duration: int) -> list[str]:
    import requests

    resp = requests.post(
        _ACOUSTID_LOOKUP,
        data={
            "client": api_key,
            "format": "json",
            "fingerprint": fingerprint,
            "duration": duration,
            "meta": "recordings sources",
        },
        timeout=30,
    )
    resp.raise_for_status()
    payload = resp.json()
    if payload.get("status") != "ok":
        message = payload.get("error", {}).get("message", "unknown error")
        raise RuntimeError(f"AcoustID: {message}")

    recordings: list[str] = []
    results = sorted(
        payload.get("results", []), key=lambda r: r.get("score", 0), reverse=True
    )
    for result in results:
        if result.get("score", 0) < _MIN_SCORE:
            continue
        # The score rates the fingerprint match, not each recording: one
        # fingerprint often links to several recordings, including bogus user
        # submissions. `sources` counts the submissions backing each link —
        # the real recording dwarfs the mislinked ones.
        by_sources = sorted(
            result.get("recordings") or [],
            key=lambda rec: rec.get("sources", 0),
            reverse=True,
        )
        for rec in by_sources:
            if rec.get("id") and rec["id"] not in recordings:
                recordings.append(rec["id"])
    return recordings[:_MAX_RECORDINGS]


def _album_for_recording(rec_id: str):
    """Resolve a recording to (AlbumInfo, TrackInfo) via its canonical release."""
    plugin = metadata.mb_plugin()
    rec = plugin.mb_api.get_recording(rec_id, includes=["releases"])
    release = metadata.pick_release(rec.get("releases", []) if isinstance(rec, dict) else [])
    if not release:
        return None, None
    album_info = plugin.album_for_id(release["id"])
    if not album_info:
        return None, None
    track_info = next((t for t in album_info.tracks if t.track_id == rec_id), None)
    if not track_info:
        return None, None
    return album_info, track_info


def _text_fallback(item, artist_hint: str | None, title_hint: str | None) -> str | None:
    """Search MusicBrainz by name using the YouTube hints. In-memory only:
    nothing is stored unless a near-perfect match is applied afterwards."""
    from beets import autotag

    if not (artist_hint or title_hint):
        return None
    item.artist = artist_hint or item.artist
    item.title = title_hint or item.title
    proposal = autotag.tag_item(item)
    for match in proposal.candidates[:1]:
        if float(match.distance) <= _MAX_TEXT_DISTANCE:
            return getattr(match.info, "track_id", None)
    return None


def _apply(item, album_info, track_info) -> None:
    # merge_with_album already carries the release's `genres` list along.
    merged = track_info.merge_with_album(album_info)
    item.update(merged)
    item.store()
    try:
        item.write()
    except Exception as exc:  # DB is authoritative; file tags are best-effort
        protocol.log(f"enrich: tag write failed: {exc}")
    try:
        # Metadata changed, so the path format (Artist/Album/nn Title) changed too.
        item.move()
    except Exception as exc:
        protocol.log(f"enrich: move failed: {exc}")


def _fetch_cover(item, release_id: str) -> None:
    import requests
    from mutagen.mp4 import MP4, MP4Cover

    album = item.get_album()
    if album is None:
        return
    resp = requests.get(
        f"https://coverartarchive.org/release/{release_id}/front", timeout=30
    )
    if resp.status_code != 200:
        protocol.log(f"enrich: no cover for release {release_id} (HTTP {resp.status_code})")
        return
    data = resp.content
    is_png = data[:4] == b"\x89PNG"

    with tempfile.NamedTemporaryFile(suffix=".png" if is_png else ".jpg", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        album.set_art(tmp_path, copy=True)
        album["art_source"] = "Cover Art Archive"
        album.store()
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    path = _decode_path(item)
    if path.endswith(".m4a") and os.path.exists(path):
        tags = MP4(path)
        fmt = MP4Cover.FORMAT_PNG if is_png else MP4Cover.FORMAT_JPEG
        tags["covr"] = [MP4Cover(data, imageformat=fmt)]
        tags.save()


def handle(request_id: str, params: dict) -> dict:
    from beets.library import Library

    lib = Library(params["beets_db"], directory=params["library_dir"])
    item = lib.get_item(params["item_id"])
    if item is None:
        raise RuntimeError(f"item not found: {params['item_id']}")
    path = _decode_path(item)
    if not os.path.exists(path):
        raise RuntimeError(f"file not found: {path}")

    metadata.ensure_plugins()

    recordings: list[str] = []
    api_key = params.get("acoustid_key")
    if api_key:
        protocol.send_event(request_id, "enrich_progress", {"stage": "fingerprint"})
        duration, fingerprint = _fingerprint(params["fpcalc"], path)
        protocol.send_event(request_id, "enrich_progress", {"stage": "lookup"})
        recordings = _lookup_recordings(api_key, fingerprint, duration)
        protocol.log(f"enrich: acoustid returned {len(recordings)} recording(s)")
    else:
        protocol.log("enrich: no AcoustID key configured, text fallback only")

    album_info = track_info = None
    for rec_id in recordings:
        try:
            album_info, track_info = _album_for_recording(rec_id)
        except Exception as exc:  # one bad recording must not sink the others
            protocol.log(f"enrich: recording {rec_id} failed: {exc}")
            continue
        if track_info:
            break

    if track_info is None:
        rec_id = _text_fallback(item, params.get("artist"), params.get("title"))
        if rec_id:
            try:
                album_info, track_info = _album_for_recording(rec_id)
            except Exception as exc:
                protocol.log(f"enrich: fallback recording {rec_id} failed: {exc}")

    matched = bool(album_info and track_info)
    if matched:
        protocol.send_event(request_id, "enrich_progress", {"stage": "apply"})
        _apply(item, album_info, track_info)
        try:
            _fetch_cover(item, album_info.album_id)
        except Exception as exc:  # metadata landed; a missing cover is not a failure
            protocol.log(f"enrich: cover fetch failed: {exc}")

    # Re-read: _text_fallback may have mutated the in-memory item without storing.
    fresh = lib.get_item(params["item_id"])
    return {"matched": matched, "report": build_report(fresh) if fresh else None}
