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

The removal itself is `undo_removal`, shared with the download undo: beets'
own API does the deleting, so the album row, the cover and the emptied
folders go along with the tracks.

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

import protocol
import undo_removal
from import_recap import BATCH_FIELD


def _batch(params: dict) -> str:
    batch = (params.get("import_id") or "").strip()
    if not batch:
        raise RuntimeError("no import id given")
    return batch


def preview(_request_id: str, params: dict) -> dict:
    """What undoing this run would remove, without removing anything."""
    from beets.library import Library

    batch = _batch(params)
    lib = Library(params["beets_db"], directory=params["library_dir"])
    try:
        return undo_removal.survey(lib, list(lib.items(f"{BATCH_FIELD}:{batch}")))
    finally:
        lib._close()


def handle(_request_id: str, params: dict) -> dict:
    """Remove everything one import brought in, and forget it was ever taken."""
    from beets.library import Library

    batch = _batch(params)
    library_dir = params["library_dir"]
    lib = Library(params["beets_db"], directory=library_dir)
    try:
        result = undo_removal.remove_items(
            list(lib.items(f"{BATCH_FIELD}:{batch}")), library_dir, "import_undo"
        )
    finally:
        lib._close()

    forgotten = forget_folder(params.get("state_file"), params.get("folder"))
    protocol.log(f"import_undo: {result['removed']} track(s) removed, {forgotten} folder(s) forgotten")
    result["forgotten"] = forgotten
    return result


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
