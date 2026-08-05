"""Music Manager sidecar: NDJSON over stdio, one request per line."""

import json
import sys
import traceback

import protocol


def _handle_ping(_request_id: str, _params: dict) -> dict:
    import platform

    import beets
    import yt_dlp

    return {
        "pong": True,
        "python": platform.python_version(),
        "beets": beets.__version__,
        "yt_dlp": yt_dlp.version.__version__,
    }


def _handlers():
    import acoustid_key
    import cover_set
    import download
    import enrich
    import enrich_album
    import genres
    import importer
    import library
    import library_align
    import library_import
    import lyrics
    import probe
    import services

    return {
        "ping": _handle_ping,
        "probe": probe.handle,
        "download": download.handle,
        "import": importer.handle,
        "library_import": library_import.handle,
        "library_align_scan": library_align.scan,
        "library_align_apply": library_align.apply,
        "enrich": enrich.handle,
        "enrich_album": enrich_album.handle,
        "library_list": library.handle,
        "library_remove": library.remove,
        "library_update": library.update,
        "cover_set": cover_set.handle,
        "cover_candidates": cover_set.candidates,
        "genres_recompute": genres.recompute,
        "lyrics_fetch": lyrics.fetch,
        "acoustid_key_check": acoustid_key.handle,
        "services_check": services.check,
    }


def main() -> None:
    handlers = _handlers()
    protocol.log("sidecar ready")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request_id = None
        try:
            request = json.loads(line)
            request_id = request["id"]
            cmd = request["cmd"]
            params = request.get("params") or {}
            handler = handlers.get(cmd)
            if handler is None:
                protocol.send_error(request_id, "unknown_command", f"unknown command: {cmd}")
                continue
            result = handler(request_id, params)
            protocol.send_result(request_id, result)
        except Exception as exc:
            protocol.log(traceback.format_exc())
            if request_id is not None:
                protocol.send_error(request_id, "internal", str(exc))
    protocol.log("stdin closed, exiting")


if __name__ == "__main__":
    main()
