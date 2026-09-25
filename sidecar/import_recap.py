"""Tag quality of what a library import brought in.

Uses `library.py`'s helpers (`first_genre`, `bucket_for`) so the counts
agree with the Metadata page.
"""

import os
import sqlite3

import library
from genre_tree import bucket_for
from library import first_genre

# Per import run; distinct from `importer.py`'s per-file `sonarche_import_id`.
BATCH_FIELD = "sonarche_library_import"


def has_gaps(numbers: set[int], declared: int) -> bool:
    """Whether the sequence 1…expected has a hole.

    `expected` is the declared track total, else the highest number. Mirrors
    `hasTracklistGaps` in the albums view.
    """
    if not numbers:
        return False
    expected = max(declared, max(numbers))
    return any(slot not in numbers for slot in range(1, expected + 1))


def _album_shapes(conn) -> dict[int, tuple[set[int], int]]:
    """Every album's track numbers and declared total, over the whole library
    so merged albums are judged on all their tracks.
    """
    shapes: dict[int, tuple[set[int], int]] = {}
    for row in conn.execute(
        "SELECT album_id, track, tracktotal FROM items WHERE album_id IS NOT NULL"
    ):
        numbers, declared = shapes.setdefault(row["album_id"], (set(), 0))
        if row["track"]:
            numbers.add(row["track"])
        if row["tracktotal"]:
            declared = max(declared, row["tracktotal"])
        shapes[row["album_id"]] = (numbers, declared)
    return shapes


def build(db_path: str, batch: str) -> dict | None:
    """The recap for one import run, or None when nothing carries its mark."""
    if not os.path.exists(db_path):
        return None

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=20.0)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT i.year, i.genres, i.album_id
            FROM items i
            JOIN item_attributes a ON a.entity_id = i.id
            WHERE a.key = ? AND a.value = ?
            """,
            (BATCH_FIELD, batch),
        ).fetchall()
        if not rows:
            return None

        tracks = len(rows)
        without_year = 0
        without_genre = 0
        off_tree = 0
        album_ids: set[int] = set()

        for row in rows:
            if not row["year"]:
                without_year += 1
            genre = first_genre(row["genres"])
            if not genre:
                without_genre += 1
            elif bucket_for(genre) is None:
                off_tree += 1
            if row["album_id"]:
                album_ids.add(row["album_id"])

        art = {
            r["id"]: r["artpath"]
            for r in conn.execute("SELECT id, artpath FROM albums")
        }
        shapes = _album_shapes(conn)
        # Collections have no tracklist, as in the albums view.
        collections = {
            album_id
            for album_id, kind in library.flex_attrs_by_album(
                conn, library.ALBUM_KIND_KEY
            ).items()
            if kind == library.COLLECTION
        }

        without_art = sum(1 for album_id in album_ids if not art.get(album_id))
        gapped = sum(
            1
            for album_id in album_ids
            if album_id not in collections and has_gaps(*shapes.get(album_id, (set(), 0)))
        )
    finally:
        conn.close()

    return {
        "tracks": tracks,
        "albums": len(album_ids),
        "withoutYear": without_year,
        "withoutGenre": without_genre,
        "offTree": off_tree,
        "albumsWithoutArt": without_art,
        "albumsWithGaps": gapped,
    }
