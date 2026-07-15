"""Field-level metadata report for a library item (shared by importer and enrich)."""

import os


def build_report(item) -> dict:
    """Which metadata fields are actually filled; the frontend derives a
    completion score from it."""
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
        # Empty mb_trackid means no trusted match was ever applied.
        "mb_matched": bool(item.mb_trackid),
        "source": item.get("data_source") or None,
        "fields": {
            "title": bool(item.title),
            "artist": bool(item.artist),
            "album": bool(item.album),
            "year": bool(item.year),
            "track": bool(item.track),
            # beets 2.12 stores genres as a list field (`genres`).
            "genre": bool(item.get("genres")),
        },
        "cover": bool(art_path and os.path.exists(art_path)),
        "cover_source": (album.get("art_source") if album else None) or None,
    }
