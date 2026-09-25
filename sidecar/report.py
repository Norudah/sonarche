"""Field-level metadata report for a library item (shared by importer and enrich)."""

import os

import provisional


def build_report(item) -> dict:
    """Which metadata fields are filled; the front derives a completion score."""
    album = None
    try:
        album = item.get_album()
    except Exception:
        pass

    art_path = album.artpath if album else None
    if isinstance(art_path, bytes):
        art_path = art_path.decode("utf-8", errors="replace")

    return {
        "item_id": item.id,
        # Lets a history row recognise its item later: beets recycles deleted rowids.
        "title": item.title or None,
        "artist": item.artist or None,
        "album": item.album or None,
        "mb_matched": bool(item.mb_trackid),
        # Tags guessed from the video rather than matched.
        "provisional": bool(item.get(provisional.FLAG)),
        "source": item.get("data_source") or None,
        "fields": {
            "title": bool(item.title),
            "artist": bool(item.artist),
            "album": bool(item.album),
            "year": bool(item.year),
            "track": bool(item.track),
            "genre": bool(item.get("genres")),
        },
        "cover": bool(art_path and os.path.exists(art_path)),
        "cover_source": (album.get("art_source") if album else None) or None,
    }
