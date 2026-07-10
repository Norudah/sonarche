"""NDJSON protocol over stdio. stdout carries protocol JSON only; everything else goes to stderr."""

import json
import sys
import threading

# Keep a private handle on the real stdout, then redirect the global one to
# stderr so any stray print() from a library cannot corrupt the protocol.
_wire = sys.stdout
sys.stdout = sys.stderr

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
