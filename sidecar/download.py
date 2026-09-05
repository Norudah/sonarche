"""Download a track with yt-dlp, keeping the native m4a/AAC stream by default.

The one exception is the audio-format setting (`audio_format.py`): someone who
listens on a device that only reads mp3 has asked, explicitly, for the
re-encode the app otherwise refuses to do behind their back. Without that
setting nothing decodes the stream — the file stored is the file served.

App rule: the file is left untagged on purpose. Video titles and channel names
are not trustworthy metadata — fields stay empty until an automation process (MusicBrainz,
AcoustID…) finds a real match. The source's own info is only returned to the caller for
display and as search hints."""

import os
import re

import audio_format
import protocol

# Prefix the caller matches on to tell "the source will never serve this" apart
# from "the download failed". A machine-readable marker rather than the raw
# yt-dlp sentence: the wording is yt-dlp's to change, and only this module
# should have to know it.
UNAVAILABLE_PREFIX = "video-unavailable:"

# What yt-dlp says when the video is gone for good — deleted, made private,
# blocked or claimed. The playlist still lists these with a full title,
# duration and channel (see probe.py), so this is the first and only moment
# the truth is knowable. Matched case-insensitively on the error text.
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
    """Whether a yt-dlp failure means the video itself is gone, rather than the
    download going wrong. Pure — unit-tested against the real messages."""
    low = (message or "").casefold()
    return any(marker in low for marker in _UNAVAILABLE_MARKERS)


def scrub(message: str) -> str:
    """A yt-dlp error with the extractor tag removed.

    Errors reach the download history and are shown on the failing row, and
    yt-dlp stamps every one with the site it came from (`ERROR: [site] …`).
    The app never names the site it fetches from, so the tag comes off here —
    at the one place that reads yt-dlp's output — while the part that says what
    actually went wrong is kept verbatim. Pure."""
    text = (message or "").strip()
    text = re.sub(r"^ERROR:\s*", "", text)
    # The tag and the video id it carries: "[site] dQw4w9WgXcQ: ".
    text = re.sub(r"^\[[^\]]+\]\s*[\w-]*:?\s*", "", text)
    return text.strip()


class _Logger:
    """Routes yt-dlp's output to stderr instead of swallowing it.

    The one that mattered: without ffmpeg, yt-dlp warns "writing DASH m4a.
    Only some players support this container" and leaves the file fragmented —
    0:00 durations in Music.app, broken seeking on iOS. `no_warnings` hid that
    message for months. Warnings are diagnostics, not noise; they belong in
    the sidecar log."""

    def debug(self, message):
        pass

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
    """yt-dlp's `js_runtimes`, for the bundled runtime or for none.

    YouTube scrambles the signature and the `n` parameter of every stream URL
    and ships the descrambler as obfuscated JavaScript; the runtime is what
    reads it. Without one, only the single client that needs no JavaScript
    answers — a lone point of failure rather than a fallback. The solver
    scripts themselves come from the `yt-dlp-ejs` package in the venv, so a
    download reaches for neither npm nor GitHub.

    Stated in both directions on purpose: left unset, yt-dlp falls back to
    `{"deno": {}}`, which searches PATH — and PATH is never trusted here.
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
        # Native AAC stream from the source; fall back to best audio without
        # re-encoding. A chosen format widens the ask instead — see
        # `audio_format.source_selector`.
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
            # Refused rather than downloaded native: the user picked a format,
            # and handing them an m4a while the setting says mp3 is the app
            # lying about what it stored.
            raise RuntimeError(f"cannot produce {fmt} without ffmpeg")
        opts["postprocessors"] = chain
        protocol.log(f"download: re-encoding to {fmt} (audio format setting)")
    if ffmpeg:
        # The bundled binary, by absolute path — PATH is never trusted. With it,
        # yt-dlp's FixupM4a remuxes the DASH m4a into a classic MP4 (`-c copy`,
        # no re-encode) as part of the download itself.
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
        # A video removed from the playlist's reach is not a failed download:
        # retrying can only fail again, and the job should report a hole in the
        # record rather than an error it could have avoided.
        message = str(exc)
        if is_unavailable_error(message):
            raise RuntimeError(f"{UNAVAILABLE_PREFIX} {scrub(message)}") from exc
        raise RuntimeError(scrub(message)) from exc

    downloads = info.get("requested_downloads") or []
    path = downloads[0]["filepath"] if downloads else None
    # The extract postprocessor rewrites `filepath` in place, but it is yt-dlp's
    # bookkeeping and not a contract: if it ever falls behind, the converted
    # file is the same name wearing the chosen suffix, and finding it there
    # beats failing a download whose audio is sitting on disk.
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
