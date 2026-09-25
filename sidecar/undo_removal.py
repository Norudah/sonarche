"""Removal core shared by `import_undo` and `download_undo`.

Removal goes through beets' API, so emptied album rows, their covers and
folders go too. Files outside the library directory are never deleted; only
their rows are.
"""

import os

import library
import protocol


def under(path: str, root: str) -> bool:
    """Whether `path` is inside `root`, both resolved (symlinked libraries)."""
    try:
        return os.path.commonpath([os.path.realpath(path), os.path.realpath(root)]) == os.path.realpath(root)
    except ValueError:  # different drives on Windows: not under, and not an error
        return False


def survey(lib, items) -> dict:
    """What removing these items would take away, read from the library as it
    is now.
    """
    item_ids: list[int] = []
    by_album: dict[int, set[int]] = {}
    for item in items:
        item_ids.append(item.id)
        if item.album_id:
            by_album.setdefault(item.album_id, set()).add(item.id)

    emptied = 0
    kept = 0
    for album_id, mine in by_album.items():
        album = lib.get_album(album_id)
        if album is None:
            continue
        if any(item.id not in mine for item in album.items()):
            kept += 1
        else:
            emptied += 1

    return {
        "tracks": len(item_ids),
        # Albums removed entirely vs albums only losing tracks.
        "albumsRemoved": emptied,
        "albumsKept": kept,
        # Playlists live in another database; the caller cleans them up.
        "itemIds": item_ids,
    }


def remove_items(items, library_dir: str, log_prefix: str) -> dict:
    """Remove items through beets, deleting files only inside the library."""
    removed: list[int] = []
    foreign = 0
    for item in items:
        path = library._decode(item.path)
        inside = bool(path) and under(path, library_dir)
        if not inside:
            foreign += 1
            protocol.log(f"{log_prefix}: {path} is outside the library, row dropped, file kept")
        else:
            _drop_staged_art(item, library_dir)
        item.remove(delete=inside)
        removed.append(item.id)

    return {
        "removed": len(removed),
        "itemIds": removed,
        # Files left in place because they were outside the library.
        "foreign": foreign,
    }


def _drop_staged_art(item, library_dir: str) -> None:
    """Delete a singleton's extracted cover, which beets doesn't know about."""
    art = item.get(library.ITEM_ART_KEY)
    if not art or not under(art, library_dir):
        return
    try:
        os.remove(art)
    except OSError:  # already gone, or never written: nothing owed
        pass
