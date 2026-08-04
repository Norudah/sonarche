"""Download a track with yt-dlp, keeping the native m4a/AAC stream (no re-encode).

App rule: the file is left untagged on purpose. YouTube titles/uploaders are not
trustworthy metadata — fields stay empty until an automation process (MusicBrainz,
AcoustID…) finds a real match. The YouTube info is only returned to the caller for
display and as search hints."""

import os
import re

import protocol

# Prefix the caller matches on to tell "YouTube will never serve this" apart
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
    yt-dlp stamps every one with the site it came from (`ERROR: [youtube] …`).
    The app never names the site it fetches from, so the tag comes off here —
    at the one place that reads yt-dlp's output — while the part that says what
    actually went wrong is kept verbatim. Pure."""
    text = (message or "").strip()
    text = re.sub(r"^ERROR:\s*", "", text)
    # The tag and the video id it carries: "[youtube] dQw4w9WgXcQ: ".
    text = re.sub(r"^\[[^\]]+\]\s*[\w-]*:?\s*", "", text)
    return text.strip()


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


def handle(request_id: str, params: dict) -> dict:
    import yt_dlp

    url = params["url"]
    staging_dir = params["staging_dir"]
    os.makedirs(staging_dir, exist_ok=True)

    opts = {
        # Native AAC stream from YouTube; fall back to best audio without re-encoding.
        "format": "bestaudio[ext=m4a]/bestaudio",
        "outtmpl": os.path.join(staging_dir, "%(title)s [%(id)s].%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "progress_hooks": [_progress_hook(request_id)],
    }

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
