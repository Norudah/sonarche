"""Import a staged file into the beets library via the beet CLI, then re-read
the imported item to report its metadata state.

The import is deliberately as-is (-A): staged files carry no tags by design,
so autotagging here would only waste MusicBrainz calls. The enrich step owns
the real matching, via the acoustic fingerprint."""

import os
import subprocess
import sys
import time
import uuid

import protocol
from report import build_report

# Flexible attribute stamped (--set) on singleton imports so the item can be
# looked up exactly. Batch imports land seconds apart with identical blank
# tags — the single-path "newest added since" heuristic mis-attributes there.
_MARKER_FIELD = "sonarche_import_id"


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


def _find_marked_item(db_path: str, library_dir: str, marker: str):
    """The item stamped with our marker, or None. Exact — no time window.
    The marker is deleted once read: it never leaks into reports or files."""
    from beets.library import Library

    if not os.path.exists(db_path):
        return None
    lib = Library(db_path, directory=library_dir)
    items = list(lib.items(f"{_MARKER_FIELD}:{marker}"))
    if not items:
        return None
    item = items[0]
    del item[_MARKER_FIELD]
    item.store()
    return item


def handle(request_id: str, params: dict) -> dict:
    path = params["path"]
    config_path = params["beets_config"]
    if not os.path.exists(path):
        raise RuntimeError(f"file not found: {path}")

    started = time.time()
    marker = None
    cmd = [_beet_bin(), "--config", config_path, "import", "--quiet", "-A", path]
    if params.get("singleton"):
        # Album tracks are imported file by file; -s avoids one junk 1-item
        # album row per file (the real album row is created by enrich_album).
        marker = uuid.uuid4().hex
        cmd[-1:-1] = ["-s", f"--set={_MARKER_FIELD}={marker}"]
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
        if marker is not None:
            item = _find_marked_item(params["beets_db"], params["library_dir"], marker)
        else:
            item = _find_imported_item(params["beets_db"], params["library_dir"], started)
        if item is not None:
            report = build_report(item)
    except Exception as exc:  # the import itself succeeded; a missing report must not fail it
        protocol.log(f"import report failed: {exc}")

    return {"imported": True, "report": report}
