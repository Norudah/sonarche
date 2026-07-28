"""Import a staged file into the beets library via the beet CLI, then re-read
the imported item to report its metadata state.

The import is deliberately as-is (-A): staged files carry no tags by design,
so autotagging here would only waste MusicBrainz calls. The enrich step owns
the real matching, via the acoustic fingerprint."""

import os
import subprocess
import sys
import uuid

import protocol
from report import build_report

# Flexible attribute stamped (--set) on every import so the item can be looked
# up exactly, whatever the import mode. Album batches land seconds apart with
# identical blank tags, so no "newest added since" heuristic can tell them
# apart — and on the single path that heuristic also meant walking the entire
# library through beets' ORM (one full Item, 98 fields, per track) to identify
# the one file we had just handed it, which got slower with every download.
_MARKER_FIELD = "sonarche_import_id"


def _beet_bin() -> str:
    """The venv's own `beet`, beside the interpreter running us.

    Named outright on Windows, where the console script is `beet.exe`. Without
    the suffix this only worked because `CreateProcess` appends `.exe` when the
    name has no extension — finding our own binary should not rest on a Win32
    fallback.
    """
    name = "beet.exe" if os.name == "nt" else "beet"
    return os.path.join(os.path.dirname(sys.executable), name)


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

    marker = uuid.uuid4().hex
    cmd = [_beet_bin(), "--config", config_path, "import", "--quiet", "-A",
           f"--set={_MARKER_FIELD}={marker}", path]
    if params.get("singleton"):
        # Album tracks are imported file by file; -s avoids one junk 1-item
        # album row per file (the real album row is created by enrich_album).
        cmd.insert(-1, "-s")
    protocol.send_event(request_id, "import_progress", {"stage": "matching"})

    # Separate process: beets' own stdout stays out of our protocol stream.
    # Encoding spelled out, like in `library_import`: left to the locale it is
    # cp1252 on Windows, and beets echoes the staged filename — which carries
    # the YouTube title, emoji and all. `replace` because a byte we cannot read
    # should cost a garbled log line, never the import.
    proc = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300
    )
    for line in (proc.stdout + proc.stderr).splitlines():
        if line.strip():
            protocol.log(f"beet: {line}")
    if proc.returncode != 0:
        raise RuntimeError(f"beet import failed (exit {proc.returncode}): {proc.stderr.strip()[:500]}")

    report = None
    try:
        item = _find_marked_item(params["beets_db"], params["library_dir"], marker)
        if item is not None:
            report = build_report(item)
    except Exception as exc:  # the import itself succeeded; a missing report must not fail it
        protocol.log(f"import report failed: {exc}")

    return {"imported": True, "report": report}
