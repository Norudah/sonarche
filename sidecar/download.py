"""Download a track with yt-dlp, keeping the native m4a/AAC stream (no re-encode).

App rule: the file is left untagged on purpose. YouTube titles/uploaders are not
trustworthy metadata — fields stay empty until an automation process (MusicBrainz,
AcoustID…) finds a real match. The YouTube info is only returned to the caller for
display and as search hints."""

import os

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

    return {
        "path": path,
        "title": info.get("track") or info.get("title"),
        "artist": info.get("artist") or info.get("uploader") or info.get("channel"),
        "album": info.get("album"),
        "duration": info.get("duration"),
        "webpage_url": info.get("webpage_url"),
        "thumbnail": info.get("thumbnail"),
    }
