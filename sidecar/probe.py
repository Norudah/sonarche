"""Resolve a URL to its playlist shape in one flat extraction (nothing downloaded).

Used before enqueueing an album job: the caller needs the entry list (per-track
watch URLs) to drive downloads one by one with its own pacing."""


def summarize(info: dict, max_entries: int) -> dict:
    """Reduce a yt-dlp flat info dict to the wire shape. Pure — unit-tested."""
    if info.get("_type") == "playlist":
        # Dedupe by video id: playlists can list the same video twice, but both
        # would stage to one file (title [id].m4a) — the first import moves it
        # away and the second fails with "file not found".
        entries, seen = [], set()
        for e in info.get("entries") or []:
            if not e or (e.get("id") and e["id"] in seen):
                continue
            seen.add(e.get("id"))
            entries.append(e)
        if not entries:
            raise RuntimeError("playlist is empty")
        if len(entries) > max_entries:
            raise RuntimeError(f"playlist too large ({len(entries)} > {max_entries} entries)")
        return {
            "is_playlist": True,
            "title": info.get("title"),
            "artist": info.get("uploader") or info.get("channel"),
            "count": len(entries),
            "entries": [
                {
                    "id": e.get("id"),
                    "title": e.get("title"),
                    "duration": e.get("duration"),
                    "url": e.get("url") or f"https://www.youtube.com/watch?v={e.get('id')}",
                }
                for e in entries
            ],
        }
    return {
        "is_playlist": False,
        "title": info.get("track") or info.get("title"),
        "artist": info.get("artist") or info.get("uploader") or info.get("channel"),
        "duration": info.get("duration"),
    }


def handle(_request_id: str, params: dict) -> dict:
    import yt_dlp

    opts = {
        "quiet": True,
        "no_warnings": True,
        # One request for the whole listing; entries stay unrealized stubs.
        "extract_flat": "in_playlist",
        "skip_download": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(params["url"], download=False)
    return summarize(info, max_entries=int(params.get("max_entries", 100)))
