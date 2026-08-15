"""The removal core both undos share.

Undoing a library import and undoing a download are the same gesture with a
different address book: `import_undo` finds its items by the beets mark, and
`download_undo` by the item ids the app recorded on the job row. Once the
items are in hand, everything around beets' removal is identical and lives
here once: the survey the confirmation states, the foreign-file guard, the
staged singleton cover, and the rule that the row goes even when the file is
not ours to delete.

Removal goes through beets' own API rather than SQL, which is what makes the
rest fall into place: the file is deleted, the album row goes when its last
track does, its cover goes with it, and the emptied directories are pruned
(legacy `cover-hq.*` from <= 2.x is declared clutter, so a folder still
holding one prunes all the same).
"""

import os

import library
import protocol


def under(path: str, root: str) -> bool:
    """Whether `path` sits inside `root`. Both resolved first, so a symlinked
    library directory does not make every one of its own files look foreign."""
    try:
        return os.path.commonpath([os.path.realpath(path), os.path.realpath(root)]) == os.path.realpath(root)
    except ValueError:  # different drives on Windows: not under, and not an error
        return False


def survey(lib, items) -> dict:
    """What removing these items would take away, without removing anything.

    The confirmation has to state a count before it asks, and the count has to
    come from the library rather than from what a run once reported: tracks
    may have been deleted by hand since, and an album may have grown.
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
        # Albums that disappear with their tracks, and albums that merely lose
        # some: two different sentences on the confirmation, and the second is
        # the one nobody expects.
        "albumsRemoved": emptied,
        "albumsKept": kept,
        # For the caller, which owns the playlists: they live in another
        # database file, so no foreign key can carry the removal across.
        "itemIds": item_ids,
    }


def remove_items(items, library_dir: str, log_prefix: str) -> dict:
    """Remove these items through beets, files included where they are ours."""
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
        # `delete` only for a file we put there. The row goes either way: it is
        # this app's record of a track it no longer claims.
        item.remove(delete=inside)
        removed.append(item.id)

    return {
        "removed": len(removed),
        "itemIds": removed,
        # Files left alone because they were not ours to delete. Reported, not
        # swallowed: it is the one outcome that does not match "everything this
        # run brought in is gone".
        "foreign": foreign,
    }


def _drop_staged_art(item, library_dir: str) -> None:
    """Delete the cover written out beside a singleton at import.

    beets knows nothing about it — it is our file, recorded on the item — so
    nothing else would remove it, and a folder still holding one would not
    prune. An album's own cover needs no such care: beets deletes `artpath`
    with the album.
    """
    art = item.get(library.ITEM_ART_KEY)
    if not art or not under(art, library_dir):
        return
    try:
        os.remove(art)
    except OSError:  # already gone, or never written: nothing owed
        pass
