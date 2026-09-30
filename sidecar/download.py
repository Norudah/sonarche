"""Download a track with yt-dlp, keeping the native m4a/AAC stream.

Re-encoding only happens when the user picked another audio format
(`audio_format.py`). Files are left untagged: video titles and channels are
not trusted metadata, only returned as display and search hints."""

import os
import re

import audio_format
import protocol

# Machine-readable marker for "the source will never serve this".
UNAVAILABLE_PREFIX = "video-unavailable:"

# yt-dlp errors for videos gone for good (deleted, private, blocked). Playlists
# still list these with full metadata, so download time is the first signal.
_UNAVAILABLE_MARKERS = (
    "video unavailable",
    "this video is not available",
    "private video",
    "video has been removed",
    "account associated with this video has been terminated",
    "who has blocked it",
    "available in your country",
    "blocked it on copyright grounds",
)


def is_unavailable_error(message: str) -> bool:
    """Whether a yt-dlp failure means the video itself is gone."""
    low = (message or "").casefold()
    return any(marker in low for marker in _UNAVAILABLE_MARKERS)


def scrub(message: str) -> str:
    """A yt-dlp error without its `[site] id:` prefix; the app never names the
    site it fetches from."""
    text = (message or "").strip()
    text = re.sub(r"^ERROR:\s*", "", text)
    text = re.sub(r"^\[[^\]]+\]\s*[\w-]*:?\s*", "", text)
    return text.strip()


class _Logger:
    """Routes yt-dlp's warnings and errors to the sidecar log (stderr)."""

    def debug(self, message):
        # yt-dlp routes screen output to `debug`. Keep only the `[jsc:` line, the
        # only place it reports which JavaScript runtime solved the challenge.
        if "[jsc:" in message:
            protocol.log(f"yt-dlp: {message}")

    def info(self, message):
        pass

    def warning(self, message):
        protocol.log(f"yt-dlp: {message}")

    def error(self, message):
        protocol.log(f"yt-dlp: {message}")


def _progress_hook(request_id):
    def hook(d):
        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0
            percent = round(downloaded / total * 100, 1) if total else None
            protocol.send_event(
                request_id,
                "download_progress",
                {
                    "percent": percent,
                    "downloaded_bytes": downloaded,
                    "total_bytes": total,
                    "speed": d.get("speed"),
                    "eta": d.get("eta"),
                },
            )
        elif status == "finished":
            protocol.send_event(request_id, "download_progress", {"percent": 100.0})

    return hook


def js_runtimes(deno: str | None) -> dict:
    """yt-dlp's `js_runtimes`: the bundled Deno, or none.

    YouTube's stream URLs need a JavaScript descrambler; without a runtime only
    one client works. Always set explicitly: unset, yt-dlp would search PATH.
    """
    return {"deno": {"path": deno}} if deno else {}


def handle(request_id: str, params: dict) -> dict:
    import yt_dlp

    url = params["url"]
    staging_dir = params["staging_dir"]
    ffmpeg = params.get("ffmpeg")
    deno = params.get("deno")
    fmt = audio_format.normalize(params.get("audio_format"))
    os.makedirs(staging_dir, exist_ok=True)

    opts = {
        # See `audio_format.source_selector`.
        "format": audio_format.source_selector(fmt),
        "outtmpl": os.path.join(staging_dir, "%(title)s [%(id)s].%(ext)s"),
        "noplaylist": True,
        "logger": _Logger(),
        "noprogress": True,
        "progress_hooks": [_progress_hook(request_id)],
    }
    chain = audio_format.postprocessors(fmt)
    if chain:
        if not ffmpeg:
            # The user picked a format; silently storing m4a would be wrong.
            raise RuntimeError(f"cannot produce {fmt} without ffmpeg")
        opts["postprocessors"] = chain
        protocol.log(f"download: re-encoding to {fmt} (audio format setting)")
    if ffmpeg:
        # Bundled ffmpeg lets FixupM4a remux DASH m4a into classic MP4 (no re-encode).
        opts["ffmpeg_location"] = ffmpeg
    else:
        protocol.log("download: no ffmpeg passed — DASH m4a will stay fragmented")
    opts["js_runtimes"] = js_runtimes(deno)
    if not deno:
        protocol.log("download: no JS runtime passed — YouTube formats may be missing")

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
    except yt_dlp.utils.DownloadError as exc:
        # Retrying can't help: report a gap in the record, not an error.
        message = str(exc)
        if is_unavailable_error(message):
            raise RuntimeError(f"{UNAVAILABLE_PREFIX} {scrub(message)}") from exc
        raise RuntimeError(scrub(message)) from exc

    downloads = info.get("requested_downloads") or []
    path = downloads[0]["filepath"] if downloads else None
    # `filepath` is yt-dlp bookkeeping, not a contract: fall back to the
    # converted file's expected name.
    if path and not os.path.exists(path):
        swapped = f"{os.path.splitext(path)[0]}.{fmt}"
        if os.path.exists(swapped):
            protocol.log(f"download: output found as {os.path.basename(swapped)}")
            path = swapped
    if not path or not os.path.exists(path):
        raise RuntimeError("download finished but output file not found")

    return {
        "path": path,
        "title": info.get("track") or info.get("title"),
        "artist": info.get("artist") or info.get("uploader") or info.get("channel"),
        "album": info.get("album"),
        "duration": info.get("duration"),
        "webpage_url": info.get("webpage_url"),
        "thumbnail": info.get("thumbnail"),
    }
