"""What a record *is*, said by the person who owns it.

An album is a release: it has a tracklist, so a missing number 7 is a hole and
the app is right to say so. A collection is a folder of tracks someone gathered
— an artist's greatest-of, a mood, twelve rips from one channel — and it has no
tracklist to be measured against. Asking it for its missing track 7 is asking
the wrong question, and answering it every time the metadata page is opened is
what made that page feel like an accusation.

So the kind is stored, not guessed: one flexible attribute on beets' album row
(`album_attributes`, the same table the import batch id lives in), absent for an
album and `collection` for a collection. Absent rather than `album` on purpose —
a library imported before this existed is made of albums, and a default that
needs no migration is worth more than a symmetric one.

Only the checks that are *about a tracklist* consult it. A collection still
wants a cover, still wants genres, still gets its tags written: it is a kind of
record, not an exemption from being catalogued.
"""

import os

import library
import protocol

VALID_KINDS = (library.COLLECTION, "album")


def handle(_request_id: str, params: dict) -> dict:
    """Set (or clear) the kind of one or more albums, by beets album id.

    Takes a list because the front groups albums by (artist, title) while beets
    keys them by row: one card on screen can be two album rows, and both have to
    move together or the card would come back as neither kind.
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
                # Deleted rather than set to "album": absent is the default, and
                # a row saying the default is a row that will outlive its
                # meaning. `del` on a beets model raises when the key is not
                # there, which here means another writer got to it first.
                try:
                    del album[library.ALBUM_KIND_KEY]
                except KeyError:
                    continue
            else:
                album[library.ALBUM_KIND_KEY] = wanted
            # `store()` only — nothing here belongs in the files. The kind is
            # Sonarche's reading of the record, not a tag any other player
            # would know what to do with, and writing it would edit N files to
            # say something none of them can carry.
            album.store()
            updated += 1
    finally:
        lib._close()

    return {"updated": updated}
