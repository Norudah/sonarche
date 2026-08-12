"""Taking an import back out of the library.

An import is a copy: the folder it read is untouched, so undoing one destroys
nothing that exists only here. That is what makes this offerable at all —
"remove what this run brought in" is a retraction, not a loss.

What makes it *exact* is the mark. Every item the run took on carries
`sonarche_library_import = <run id>` in beets' `item_attributes`, a row of its
own. Renaming an album, fixing an artist, rewriting genres, letting the
alignment pass over it — none of that touches the mark, and beets follows the
file when a rename moves it. So the set of tracks this removes is the set the
run created, months and edits later.

Removal goes through beets' own API rather than SQL, which is what makes the
rest fall into place: the file is deleted, the album row goes when its last
track does, its cover goes with it, and the emptied directories are pruned
(`cover-hq.*` is declared clutter, so a folder holding only one still prunes).

Two things this deliberately does *not* do:

- Touch an album the run only added to. Its other tracks were here first, so
  the row stays and loses exactly the tracks that arrived.
- Delete anything outside the library directory. Nothing an import created can
  be there, so a path that is says something went wrong earlier — and the
  answer to that is to forget the row, never to delete a stranger's file.

Beets' incremental memory is cleared for the folder at the end. Without it the
next import of the same folder would walk it, skip every directory it
remembers taking, and report "0 dossier · Importé" — which is the exact
failure a user undoing an import is most likely to hit next.
"""

import os

import library
import protocol
from import_recap import BATCH_FIELD


def _batch(params: dict) -> str:
    batch = (params.get("import_id") or "").strip()
    if not batch:
        raise RuntimeError("no import id given")
    return batch


def _under(path: str, root: str) -> bool:
    """Whether `path` sits inside `root`. Both resolved first, so a symlinked
    library directory does not make every one of its own files look foreign."""
    try:
        return os.path.commonpath([os.path.realpath(path), os.path.realpath(root)]) == os.path.realpath(root)
    except ValueError:  # different drives on Windows: not under, and not an error
        return False


def preview(_request_id: str, params: dict) -> dict:
    """What undoing this run would remove, without removing anything.

    The confirmation has to state a count before it asks, and the count has to
    come from the library rather than from what the run once reported: tracks
    may have been deleted by hand since, and an album may have grown.
    """
    from beets.library import Library

    batch = _batch(params)
    lib = Library(params["beets_db"], directory=params["library_dir"])
    try:
        item_ids: list[int] = []
        by_album: dict[int, set[int]] = {}
        for item in lib.items(f"{BATCH_FIELD}:{batch}"):
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
    finally:
        lib._close()

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


def handle(_request_id: str, params: dict) -> dict:
    """Remove everything one import brought in, and forget it was ever taken."""
    from beets.library import Library

    batch = _batch(params)
    library_dir = params["library_dir"]
    lib = Library(params["beets_db"], directory=library_dir)
    removed: list[int] = []
    foreign = 0
    try:
        for item in lib.items(f"{BATCH_FIELD}:{batch}"):
            path = library._decode(item.path)
            inside = bool(path) and _under(path, library_dir)
            if not inside:
                foreign += 1
                protocol.log(f"import_undo: {path} is outside the library, row dropped, file kept")
            else:
                _drop_staged_art(item, library_dir)
            # `delete` only for a file we put there. The row goes either way:
            # it is this app's record of a track it no longer claims.
            item.remove(delete=inside)
            removed.append(item.id)
    finally:
        lib._close()

    forgotten = forget_folder(params.get("state_file"), params.get("folder"))
    protocol.log(f"import_undo: {len(removed)} track(s) removed, {forgotten} folder(s) forgotten")

    return {
        "removed": len(removed),
        "itemIds": removed,
        # Files left alone because they were not ours to delete. Reported, not
        # swallowed: it is the one outcome that does not match "everything this
        # import brought in is gone".
        "foreign": foreign,
        "forgotten": forgotten,
    }


def _drop_staged_art(item, library_dir: str) -> None:
    """Delete the cover written out beside a singleton at import.

    beets knows nothing about it — it is our file, recorded on the item — so
    nothing else would remove it, and a folder still holding one would not
    prune. An album's own cover needs no such care: beets deletes `artpath`
    with the album.
    """
    art = item.get(library.ITEM_ART_KEY)
    if not art or not _under(art, library_dir):
        return
    try:
        os.remove(art)
    except OSError:  # already gone, or never written: nothing owed
        pass


def forget_folder(state_file: str | None, folder: str | None) -> int:
    """Drop a folder from beets' incremental memory. Returns entries removed.

    Surgical rather than deleting the state file: that memory covers every
    folder ever imported, and dropping all of it would make the *next* import
    of some other folder re-walk and re-copy what it already holds. Entries are
    tuples of directory paths, in bytes; anything at or under the folder goes.
    """
    if not state_file or not folder or not os.path.exists(state_file):
        return 0

    from beets.importer.state import ImportState

    # Both spellings: beets stored the path as the app handed it over, and a
    # source folder reached through a symlink (`/tmp/…` on macOS) has a real
    # path that shares no prefix with it. Comparing against one of the two
    # would silently forget nothing.
    roots = {os.fsencode(os.path.normpath(folder)), os.fsencode(os.path.realpath(folder))}
    state = ImportState(path=os.fsencode(state_file))
    before = len(state.taghistory) + len(state.tagprogress)
    state.taghistory = {
        paths for paths in state.taghistory if not any(_under_any(path, roots) for path in paths)
    }
    state.tagprogress = {
        toppath: paths for toppath, paths in state.tagprogress.items() if not _under_any(toppath, roots)
    }
    with state:
        pass  # the context manager's exit is what writes the file back
    return before - (len(state.taghistory) + len(state.tagprogress))


def _under_any(path: bytes, roots: set[bytes]) -> bool:
    """Path containment on beets' own byte paths, without decoding them: a
    library can hold filenames that are not valid text in any encoding."""
    separator = os.fsencode(os.sep)
    return any(path == root or path.startswith(root + separator) for root in roots)
