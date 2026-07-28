"""NDJSON protocol over stdio. stdout carries protocol JSON only; everything else goes to stderr."""

import json
import sys
import threading

# Keep a private handle on the real stdout, then redirect the global one to
# stderr so any stray print() from a library cannot corrupt the protocol.
_wire = sys.stdout
sys.stdout = sys.stderr

# UTF-8 on all three, before anything is written. Python picks the locale
# encoding for stdio, which on Windows is cp1252 — and `_send` serializes with
# `ensure_ascii=False`, so the line carries raw characters. A YouTube title with
# an emoji in it was enough: `'charmap' codec can't encode characters`, and the
# job died. It never showed on macOS, where the locale encoding is already
# UTF-8.
#
# Both directions, not just the wire: a request carrying a non-ASCII string
# would fail to *decode* on the way in for exactly the same reason.
#
# This is also a contract with the Rust side, which reads the channel with
# `AsyncBufReadExt::lines()` — that yields `String` and accepts nothing but
# UTF-8. `PYTHONUTF8=1` is set at spawn too, but the channel's encoding is this
# module's business and must not depend on who launched it.
for _stream in (_wire, sys.stdin, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

_lock = threading.Lock()


def _send(payload: dict) -> None:
    line = json.dumps(payload, ensure_ascii=False, default=str)
    with _lock:
        _wire.write(line + "\n")
        _wire.flush()


def send_result(request_id: str, result: dict) -> None:
    _send({"id": request_id, "ok": True, "result": result})


def send_error(request_id: str, code: str, message: str) -> None:
    _send({"id": request_id, "ok": False, "error": {"code": code, "message": message}})


def send_event(request_id: str, event: str, data: dict) -> None:
    _send({"id": request_id, "event": event, "data": data})


def log(message: str) -> None:
    sys.stderr.write(f"[sidecar] {message}\n")
    sys.stderr.flush()
