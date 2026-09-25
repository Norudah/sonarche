"""Remove one download's tracks from the library.

The download counterpart of `import_undo`, keyed by the item ids recorded on
the job; ids already gone are ignored. Removal itself is `undo_removal`.
"""

import protocol
import undo_removal


def _resolved(lib, params: dict) -> list:
    items = []
    for value in params.get("item_ids") or []:
        item = lib.get_item(int(value))
        if item is not None:
            items.append(item)
    return items


def preview(_request_id: str, params: dict) -> dict:
    """What undoing this download would remove, without removing anything."""
    from beets.library import Library

    lib = Library(params["beets_db"], directory=params["library_dir"])
    try:
        return undo_removal.survey(lib, _resolved(lib, params))
    finally:
        lib._close()


def handle(_request_id: str, params: dict) -> dict:
    """Remove everything one download brought in."""
    from beets.library import Library

    library_dir = params["library_dir"]
    lib = Library(params["beets_db"], directory=library_dir)
    try:
        result = undo_removal.remove_items(_resolved(lib, params), library_dir, "download_undo")
    finally:
        lib._close()

    protocol.log(f"download_undo: {result['removed']} track(s) removed")
    return result
