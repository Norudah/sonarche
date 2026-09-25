"""Import a staged file into beets via the CLI, then report its metadata.

The import is as-is (-A): staged files carry no tags, and matching is done
by the enrich step."""

import os
import subprocess
import sys
import uuid

import protocol
from report import build_report

# Stamped on each import (--set) to find the item exactly: album tracks land
# seconds apart with identical blank tags.
_MARKER_FIELD = "sonarche_import_id"


def beet_bin() -> str:
    """The venv's own `beet` executable, next to the running interpreter."""
    name = "beet.exe" if os.name == "nt" else "beet"
    return os.path.join(os.path.dirname(sys.executable), name)


def _find_marked_item(db_path: str, library_dir: str, marker: str):
    """The item carrying our marker, or None. The marker is deleted once read."""
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
    cmd = [beet_bin(), "--config", config_path, "import", "--quiet", "-A",
           f"--set={_MARKER_FIELD}={marker}", path]
    if params.get("singleton"):
        # -s avoids a junk one-item album row per file; enrich_album creates the real one.
        cmd.insert(-1, "-s")
    protocol.send_event(request_id, "import_progress", {"stage": "matching"})

    # Separate process keeps beets' stdout off the protocol stream. Explicit
    # encoding: the Windows locale (cp1252) breaks on non-ASCII filenames.
    proc = subprocess.run(
        cmd,
        stdin=subprocess.DEVNULL,  # same guard as library_import: beets must never read our protocol pipe
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=300,
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
