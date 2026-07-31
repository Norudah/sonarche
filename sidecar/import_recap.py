"""What a library import actually brought in, counted once it has landed.

The point is not the copy — the app already counts folders while beets walks
them. It is the *state of the tags* that arrived. A library import is deliberately
as-is (`-A`: no MusicBrainz, no AcoustID, no genre lookup), so what lands is
exactly what the files already carried, and "import terminé" says nothing about
whether that is worth anything.

Read from SQLite through `library.py`'s own helpers rather than through beets'
ORM, for two reasons. Speed is the lesser one. The real one is that these counts
have to agree with what the Metadata page says about the very same tracks: it
resolves a genre through `first_genre` and a family through `bucket_for`, and a
recap that split the delimited `genres` column its own way would quietly report
a different library than the one the user is about to go and look at.
"""

import os
import sqlite3

from genre_tree import bucket_for
from library import first_genre

# The flexible attribute stamped on every item of one import run. Its own key
# rather than `importer.py`'s `sonarche_import_id`, which is a per-file token the
# download path uses to find the item it just staged: same word, different
# lifetime, and one of them is meant to last.
BATCH_FIELD = "sonarche_library_import"


def has_gaps(numbers: set[int], declared: int) -> bool:
    """A hole in the numbered sequence 1…expected.

    `expected` is the declared track total when any track carries one, else the
    highest number present. An album with no numbered track at all has no
    sequence to have holes in — that is a missing-tags problem, not a gapped
    tracklist. Mirrors `hasTracklistGaps` in the albums view; the two must agree
    or the same album gets two verdicts.
    """
    if not numbers:
        return False
    expected = max(declared, max(numbers))
    return any(slot not in numbers for slot in range(1, expected + 1))


def _album_shapes(conn) -> dict[int, tuple[set[int], int]]:
    """Every album's numbered tracks and declared total.

    Over the whole library rather than over the import: an album the import
    merged into one that was already there has to be judged on all of its
    tracks, not on the half that just arrived.
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
    """The recap for one import run, or None when nothing carries its mark.

    None rather than a row of zeroes: an import that landed nothing and an
    import whose mark we failed to write are different facts, and the interface
    should be able to stay quiet about the second rather than claim the first.
    """
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

        without_art = sum(1 for album_id in album_ids if not art.get(album_id))
        gapped = sum(
            1
            for album_id in album_ids
            if has_gaps(*shapes.get(album_id, (set(), 0)))
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
