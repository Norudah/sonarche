"""Import a staged file into the beets library via the beet CLI (quiet autotag)."""

import os
import subprocess
import sys

import protocol


def _beet_bin() -> str:
    return os.path.join(os.path.dirname(sys.executable), "beet")


def handle(request_id: str, params: dict) -> dict:
    path = params["path"]
    config_path = params["beets_config"]
    if not os.path.exists(path):
        raise RuntimeError(f"file not found: {path}")

    cmd = [_beet_bin(), "--config", config_path, "import", "--quiet", path]
    protocol.send_event(request_id, "import_progress", {"stage": "matching"})

    # Separate process: beets' own stdout stays out of our protocol stream.
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    for line in (proc.stdout + proc.stderr).splitlines():
        if line.strip():
            protocol.log(f"beet: {line}")
    if proc.returncode != 0:
        raise RuntimeError(f"beet import failed (exit {proc.returncode}): {proc.stderr.strip()[:500]}")

    return {"imported": True}
