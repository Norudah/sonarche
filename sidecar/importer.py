"""Import a staged file into the beets library via the beet CLI (quiet autotag),
then re-read the imported item to report which metadata the autotag actually filled."""

import os
import subprocess
import sys
import time

import protocol


def _beet_bin() -> str:
    return os.path.join(os.path.dirname(sys.executable), "beet")


def _find_imported_item(db_path: str, library_dir: str, since: float):
    """The item added by this import, or None (e.g. duplicate skipped).

    Requests are processed serially, so 'newest item added after the import
    started' can only be ours.
    """
    from beets.library import Library

    if not os.path.exists(db_path):
        return None
    lib = Library(db_path, directory=library_dir)
    newest = None
    for item in lib.items():
        if item.added and item.added >= since - 1:
            if newest is None or item.added > newest.added:
                newest = item
    return newest


def _build_report(item) -> dict:
    """Field-level presence report; the frontend derives a completion score from it."""
    album = None
    try:
        album = item.get_album()
    except Exception:
        pass

    art_path = album.artpath if album else None
    if isinstance(art_path, bytes):
        art_path = art_path.decode("utf-8", errors="replace")

    return {
        "item_id": item.id,
        # Empty mb_trackid means the autotag found no match and fell back to asis.
        "mb_matched": bool(item.mb_trackid),
        "source": item.get("data_source") or None,
        "fields": {
            "title": bool(item.title),
            "artist": bool(item.artist),
            "album": bool(item.album),
            "year": bool(item.year),
            "track": bool(item.track),
            "genre": bool(item.get("genre")),
        },
        "cover": bool(art_path and os.path.exists(art_path)),
        "cover_source": (album.get("art_source") if album else None) or None,
    }


def handle(request_id: str, params: dict) -> dict:
    path = params["path"]
    config_path = params["beets_config"]
    if not os.path.exists(path):
        raise RuntimeError(f"file not found: {path}")

    started = time.time()
    cmd = [_beet_bin(), "--config", config_path, "import", "--quiet", path]
    protocol.send_event(request_id, "import_progress", {"stage": "matching"})

    # Separate process: beets' own stdout stays out of our protocol stream.
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    for line in (proc.stdout + proc.stderr).splitlines():
        if line.strip():
            protocol.log(f"beet: {line}")
    if proc.returncode != 0:
        raise RuntimeError(f"beet import failed (exit {proc.returncode}): {proc.stderr.strip()[:500]}")

    report = None
    try:
        item = _find_imported_item(params["beets_db"], params["library_dir"], started)
        if item is not None:
            report = _build_report(item)
    except Exception as exc:  # the import itself succeeded; a missing report must not fail it
        protocol.log(f"import report failed: {exc}")

    return {"imported": True, "report": report}
