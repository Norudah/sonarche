"""Taking one download back out of the library.

The download twin of `import_undo`, with a different address book: a download
has no source folder and no beets mark — the item ids the app recorded on the
job row are its only memory. Ids are resolved against the library as it is
now, so a track already deleted by hand simply does not count, and an id that
was recycled onto something else is still removed only if the caller sent it
(the app's own guard decides what to send).

Everything else — the survey, the foreign-file guard, beets doing the actual
removal so albums, covers and emptied folders go along — is `undo_removal`,
shared with the import undo. There is nothing to forget afterwards: downloads
never touch beets' incremental import memory.
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
