"""The kind of a record, as declared by the user.

An album has a tracklist that can have gaps; a collection (a user-made
gathering) does not. Stored as a flexible attribute on the album row:
absent means album (no migration needed), `collection` otherwise. Only
tracklist checks consult it.
"""

import os

import library
import protocol

VALID_KINDS = (library.COLLECTION, "album")


def handle(_request_id: str, params: dict) -> dict:
    """Set or clear the kind of albums by beets album id. One UI card can span
    several album rows, which must change together.
    """
    kind = params["kind"]
    if kind not in VALID_KINDS:
        raise RuntimeError(f"unknown album kind: {kind}")

    album_ids = [int(value) for value in params.get("album_ids") or []]
    if not album_ids:
        return {"updated": 0}

    db_path = params["beets_db"]
    if not os.path.exists(db_path):
        raise RuntimeError("library not found")

    from beets.library import Library

    lib = Library(db_path, directory=params["library_dir"])
    updated = 0
    try:
        for album_id in album_ids:
            album = lib.get_album(album_id)
            if album is None:
                protocol.log(f"album_kind: no album {album_id}, skipped")
                continue
            current = album.get(library.ALBUM_KIND_KEY) or None
            wanted = library.COLLECTION if kind == library.COLLECTION else None
            if current == wanted:
                continue
            if wanted is None:
                # Absent is the default. `del` raises if another writer removed it first.
                try:
                    del album[library.ALBUM_KIND_KEY]
                except KeyError:
                    continue
            else:
                album[library.ALBUM_KIND_KEY] = wanted
            # App-only attribute, not written to tags.
            album.store()
            updated += 1
    finally:
        lib._close()

    return {"updated": updated}
