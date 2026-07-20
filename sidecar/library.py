"""Read the beets library (SQLite). Read-only: the importer is the only writer.

The listing path reads the SQLite columns directly rather than going through
beets' ORM. `lib.items()` builds a full `Item` per track — 98 fields plus the
machinery to mutate and re-save them — and we keep 15 of those fields and
discard the rest. That object is the right tool for tagging, which is what
beets is for; it is the wrong tool for "hand me the whole library to display".
Measured on a 10 000-track library: ~1730 ms through the ORM, ~80 ms in SQL.

Everything that *writes* (import, enrich, remove) still goes through beets'
API, which is what the architecture invariant asks for: read its SQLite, never
write it directly.
"""

import os
import sqlite3

from genre_tree import bucket_for

# beets joins multi-valued tags with this in the DB, and formats them with "; "
# when the value came from a file's own tags. `DelimitedString.parse` accepts
# either, so we do too.
_GENRE_DB_DELIMITER = "\\␀"
_GENRE_FMT_DELIMITER = "; "

# Flexible (non-column) attributes we surface. Anything not listed here stays
# in item_attributes and is never read.
_BONUS_SOURCE_KEY = "sonarche_bonus_source"

_ITEM_COLUMNS = (
    "id, title, artist, album, albumartist, year, genres, track, tracktotal,"
    " length, bitrate, format, path, album_id, added"
)


def _decode(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def expand_db_path(stored, library_dir: str) -> str | None:
    """Absolute path for a path as beets stores it.

    Beets keeps paths *relative* to the library directory when the file lives
    under it, with a POSIX separator regardless of platform, and absolute
    otherwise. The ORM expands them on read; reading the column ourselves means
    doing it ourselves. Mirrors `beets.dbcore.pathutils.expand_path_from_db` —
    skipping this yields paths that look plausible and resolve to nothing.
    """
    if not stored:
        return None
    path = _decode(stored)
    if os.path.isabs(path):
        return path
    return os.path.normpath(os.path.join(library_dir, path.replace("/", os.sep)))


def first_genre(stored: str | None) -> str | None:
    """Primary genre out of beets' delimited `genres` column."""
    if not stored:
        return None
    delimiter = (
        _GENRE_DB_DELIMITER if _GENRE_DB_DELIMITER in stored else _GENRE_FMT_DELIMITER
    )
    return next((part for part in stored.split(delimiter) if part.strip()), None)


def _art_path(artpath: str | None) -> str | None:
    """Sonarche displays the HQ cover (cover-hq.*) next to beets' own artpath
    (the 500px thumb it embeds/tracks); fall back to the artpath itself for
    albums enriched before the HQ/thumb split."""
    if not artpath:
        return None
    art_dir = os.path.dirname(artpath)
    for ext in ("jpg", "png"):
        hq_path = os.path.join(art_dir, f"cover-hq.{ext}")
        if os.path.exists(hq_path):
            return hq_path
    return artpath


def art_paths_by_album(conn, library_dir: str) -> dict[int, str | None]:
    """Resolve every album's cover once, up front.

    Cover art is an album-level property; resolving it per track meant one
    query and two stat() calls each, to answer a question with one answer per
    album. Keeps the work proportional to albums, not tracks.
    """
    return {
        row["id"]: _art_path(expand_db_path(row["artpath"], library_dir))
        for row in conn.execute("SELECT id, artpath FROM albums")
    }


def bonus_sources_by_item(conn) -> dict[int, str]:
    """`sonarche_bonus_source` is a flexible attribute, so it lives in
    item_attributes rather than a column. One indexed query for the whole
    library instead of a lookup per track."""
    return {
        row["entity_id"]: row["value"]
        for row in conn.execute(
            "SELECT entity_id, value FROM item_attributes WHERE key = ?",
            (_BONUS_SOURCE_KEY,),
        )
        if row["value"]
    }


def track_row(row, art_by_album, bonus_by_item, library_dir: str) -> dict:
    """One SQLite row -> the wire shape the front consumes."""
    genre = first_genre(row["genres"])
    return {
        "id": row["id"],
        "title": row["title"],
        "artist": row["artist"],
        "album": row["album"],
        "album_artist": row["albumartist"],
        "year": row["year"] or None,
        "genre": genre,
        # Broad browse family (e.g. "Metal") derived from the specific genre.
        "genre_bucket": bucket_for(genre),
        "track": row["track"] or None,
        "track_total": row["tracktotal"] or None,
        "length": round(row["length"], 1) if row["length"] else None,
        "bitrate": row["bitrate"] or None,
        "format": row["format"],
        "path": expand_db_path(row["path"], library_dir),
        # Singletons carry no album_id and simply miss.
        "art_path": art_by_album.get(row["album_id"]),
        # Origin release of an adopted bonus track (deluxe/regional
        # edition filed with the main album), or None.
        "bonus_source": bonus_by_item.get(row["id"]),
        "added": row["added"],
    }


def handle(_request_id: str, params: dict) -> dict:
    db_path = params["beets_db"]
    if not os.path.exists(db_path):
        return {"tracks": []}

    library_dir = params["library_dir"]
    # Read-only: the URI form makes that a guarantee rather than a convention,
    # so a bug here can never touch the library beets owns.
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        art_by_album = art_paths_by_album(conn, library_dir)
        bonus_by_item = bonus_sources_by_item(conn)
        # Sorted in SQLite rather than in Python. COALESCE keeps a row with no
        # `added` at the bottom instead of letting NULL sort unpredictably.
        rows = conn.execute(
            f"SELECT {_ITEM_COLUMNS} FROM items ORDER BY COALESCE(added, 0) DESC"
        )
        tracks = [track_row(r, art_by_album, bonus_by_item, library_dir) for r in rows]
    finally:
        conn.close()

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
