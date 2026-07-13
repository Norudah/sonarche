"""Read the beets library (SQLite). Read-only: the importer is the only writer."""

import os


def _decode(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def handle(_request_id: str, params: dict) -> dict:
    from beets.library import Library

    db_path = params["beets_db"]
    if not os.path.exists(db_path):
        return {"tracks": []}

    # Beets stores item paths relative to the library directory; it must match the config.
    lib = Library(db_path, directory=params["library_dir"])
    tracks = []
    for item in lib.items():
        art_path = None
        try:
            album_obj = item.get_album()
            if album_obj and album_obj.artpath:
                art_path = _decode(album_obj.artpath)
        except Exception:
            art_path = None
        tracks.append(
            {
                "id": item.id,
                "title": item.title,
                "artist": item.artist,
                "album": item.album,
                "album_artist": item.albumartist,
                "year": item.year or None,
                "genre": item.get("genre") or None,
                "track": item.track or None,
                "track_total": item.tracktotal or None,
                "length": round(item.length, 1) if item.length else None,
                "bitrate": item.bitrate or None,
                "format": item.format,
                "path": _decode(item.path),
                "art_path": art_path,
                "added": item.added,
            }
        )
    tracks.sort(key=lambda t: t["added"] or 0, reverse=True)
    return {"tracks": tracks}
