"""NDJSON protocol over stdio. stdout carries protocol JSON only; everything else goes to stderr."""

import json
import sys
import threading

# Redirect the global stdout to stderr so stray print() calls can't corrupt
# the protocol.
_wire = sys.stdout
sys.stdout = sys.stderr

# Force UTF-8 on all streams: Windows defaults to cp1252, and the Rust side
# reads lines as UTF-8 `String`s. `errors="replace"` covers lone surrogates
# from invalid Windows filenames.
for _stream in (_wire, sys.stdin, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

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
