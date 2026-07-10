"""Download a track with yt-dlp, keeping the native m4a/AAC stream (no re-encode)."""

import os

from mutagen.mp4 import MP4

import protocol


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


def _tag_m4a(path: str, info: dict) -> None:
    """Write basic tags from YouTube metadata so beets has something to match on."""
    if not path.endswith(".m4a"):
        return
    tags = MP4(path)
    title = info.get("track") or info.get("title")
    artist = info.get("artist") or info.get("uploader") or info.get("channel")
    if title:
        tags["\xa9nam"] = [title]
    if artist:
        tags["\xa9ART"] = [artist]
    if info.get("album"):
        tags["\xa9alb"] = [info["album"]]
    if info.get("release_year"):
        tags["\xa9day"] = [str(info["release_year"])]
    tags.save()


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

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)

    downloads = info.get("requested_downloads") or []
    path = downloads[0]["filepath"] if downloads else None
    if not path or not os.path.exists(path):
        raise RuntimeError("download finished but output file not found")

    try:
        _tag_m4a(path, info)
    except Exception as exc:  # tagging is best-effort; the file is still usable
        protocol.log(f"tagging failed: {exc}")

    return {
        "path": path,
        "title": info.get("track") or info.get("title"),
        "artist": info.get("artist") or info.get("uploader") or info.get("channel"),
        "album": info.get("album"),
        "duration": info.get("duration"),
        "webpage_url": info.get("webpage_url"),
        "thumbnail": info.get("thumbnail"),
    }
