"""Read the beets library (SQLite). Read-only: the importer is the only writer."""

import os

from genre_tree import bucket_for


def _decode(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def _art_path(album_obj) -> str | None:
    """Sonarche displays the HQ cover (cover-hq.*) next to beets' own artpath
    (the 500px thumb it embeds/tracks); fall back to the artpath itself for
    albums enriched before the HQ/thumb split."""
    if not album_obj or not album_obj.artpath:
        return None
    artpath = _decode(album_obj.artpath)
    art_dir = os.path.dirname(artpath)
    for ext in ("jpg", "png"):
        hq_path = os.path.join(art_dir, f"cover-hq.{ext}")
        if os.path.exists(hq_path):
            return hq_path
    return artpath


def art_paths_by_album(lib) -> dict[int, str | None]:
    """Resolve every album's cover once, up front.

    Cover art is an album-level property, but it used to be looked up per
    *track*: `item.get_album()` issued one SQL query each, and `_art_path` then
    stat'd the filesystem twice more. A 5 000-track library paid ~15 000 calls
    to answer a few hundred distinct questions. One pass over the albums keeps
    the work proportional to albums, not tracks.

    Worth 1.37x on a 10 000-track library — real but not the bottleneck. Most
    of the remaining time is beets materializing a full Item object per track;
    reading the columns straight from SQLite is ~20x on top of this.
    """
    return {album.id: _art_path(album) for album in lib.albums()}


def handle(_request_id: str, params: dict) -> dict:
    from beets.library import Library

    db_path = params["beets_db"]
    if not os.path.exists(db_path):
        return {"tracks": []}

    # Beets stores item paths relative to the library directory; it must match the config.
    lib = Library(db_path, directory=params["library_dir"])
    art_by_album = art_paths_by_album(lib)
    tracks = []
    for item in lib.items():
        # `album_id` is a column on the item itself, so this is a dict lookup
        # rather than the per-track album query it replaces. Singletons carry
        # no album_id and simply miss.
        art_path = art_by_album.get(item.album_id)
        # beets 2.12 keeps a `genres` list; expose the primary one.
        genre = next(iter(item.get("genres") or []), None)
        tracks.append(
            {
                "id": item.id,
                "title": item.title,
                "artist": item.artist,
                "album": item.album,
                "album_artist": item.albumartist,
                "year": item.year or None,
                "genre": genre,
                # Broad browse family (e.g. "Metal") derived from the specific genre.
                "genre_bucket": bucket_for(genre),
                "track": item.track or None,
                "track_total": item.tracktotal or None,
                "length": round(item.length, 1) if item.length else None,
                "bitrate": item.bitrate or None,
                "format": item.format,
                "path": _decode(item.path),
                "art_path": art_path,
                # Origin release of an adopted bonus track (deluxe/regional
                # edition filed with the main album), or None.
                "bonus_source": item.get("sonarche_bonus_source") or None,
                "added": item.added,
            }
        )
    tracks.sort(key=lambda t: t["added"] or 0, reverse=True)
    return {"tracks": tracks}


def remove(_request_id: str, params: dict) -> dict:
    """Remove a track from the library and delete its file. Goes through beets'
    API (not raw SQL) so the DB and any now-empty album stay consistent."""
    from beets.library import Library

    db_path = params["beets_db"]
    if not os.path.exists(db_path):
        raise RuntimeError("library not found")

    lib = Library(db_path, directory=params["library_dir"])
    item = lib.get_item(params["id"])
    if item is None:
        raise RuntimeError(f"track not found: id={params['id']}")

    item.remove(delete=True)
    return {"removed": True}
