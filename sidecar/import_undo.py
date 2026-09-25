"""Undo a library import.

Imports copy, so undoing destroys nothing unique. Items are found by the
run's `sonarche_library_import` mark, which survives edits and renames.
Albums the run only added to keep their older tracks, and files outside the
library are never deleted. beets' incremental state is cleared for the
folder so re-importing it works.
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
    from beets.library import Library

    batch = _batch(params)
    lib = Library(params["beets_db"], directory=params["library_dir"])
    try:
        return undo_removal.survey(lib, list(lib.items(f"{BATCH_FIELD}:{batch}")))
    finally:
        lib._close()


def handle(_request_id: str, params: dict) -> dict:
    """Remove everything one import brought in, and forget the folder."""
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
    """Drop a folder from beets' incremental import state. Returns entries removed.

    Only this folder's entries: the state covers every folder ever imported.
    """
    if not state_file or not folder or not os.path.exists(state_file):
        return 0

    from beets.importer.state import ImportState

    # Both spellings: a symlinked source (`/tmp` on macOS) has an unrelated real path.
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
    """Path containment on raw byte paths (filenames may not be valid text)."""
    separator = os.fsencode(os.sep)
    return any(path == root or path.startswith(root + separator) for root in roots)
