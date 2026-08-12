import os
import shutil
import sqlite3
import tempfile
import unittest

import import_recap
import library

# The three columns of beets' schema this module reads, and nothing else. Built
# by hand rather than by running beets: the interesting cases (a delimited genre
# column, an album with a hole in it) are shapes of stored data, and a real
# import cannot be asked to produce them on demand.
_SCHEMA = """
CREATE TABLE items (
    id INTEGER PRIMARY KEY, year INTEGER, genres TEXT,
    track INTEGER, tracktotal INTEGER, album_id INTEGER
);
CREATE TABLE albums (id INTEGER PRIMARY KEY, artpath BLOB);
CREATE TABLE item_attributes (entity_id INTEGER, key TEXT, value TEXT);
CREATE TABLE album_attributes (entity_id INTEGER, key TEXT, value TEXT);
"""


class RecapTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.db = os.path.join(self.dir, "library.db")
        self.conn = sqlite3.connect(self.db)
        self.conn.executescript(_SCHEMA)
        self.next_id = 0

    def tearDown(self):
        self.conn.close()
        shutil.rmtree(self.dir, ignore_errors=True)

    def _album(self, album_id: int, artpath: bytes | None) -> None:
        self.conn.execute("INSERT INTO albums (id, artpath) VALUES (?, ?)", (album_id, artpath))

    def _collection(self, album_id: int) -> None:
        self.conn.execute(
            "INSERT INTO album_attributes (entity_id, key, value) VALUES (?, ?, ?)",
            (album_id, library.ALBUM_KIND_KEY, library.COLLECTION),
        )
        self.conn.commit()

    def _item(self, batch: str | None = "run-1", **fields) -> int:
        self.next_id += 1
        row = {"year": 2001, "genres": "French House", "track": 1, "tracktotal": 1, "album_id": 1}
        row.update(fields)
        self.conn.execute(
            "INSERT INTO items (id, year, genres, track, tracktotal, album_id)"
            " VALUES (:id, :year, :genres, :track, :tracktotal, :album_id)",
            {"id": self.next_id, **row},
        )
        if batch is not None:
            self.conn.execute(
                "INSERT INTO item_attributes (entity_id, key, value) VALUES (?, ?, ?)",
                (self.next_id, import_recap.BATCH_FIELD, batch),
            )
        self.conn.commit()
        return self.next_id

    def test_counts_only_what_this_run_brought_in(self):
        """The whole reason the mark exists: a library holds other imports."""
        self._album(1, b"/music/a/cover.jpg")
        self._item()
        self._item()
        self._item(batch="an-earlier-run")
        self._item(batch=None)

        recap = import_recap.build(self.db, "run-1")

        self.assertEqual(recap["tracks"], 2)

    def test_reports_nothing_rather_than_zeroes_when_the_mark_is_missing(self):
        """An import that landed nothing and an import whose mark failed to be
        written are different facts."""
        self._album(1, b"/music/a/cover.jpg")
        self._item(batch="another")

        self.assertIsNone(import_recap.build(self.db, "run-1"))

    def test_a_missing_database_is_not_an_error(self):
        self.assertIsNone(import_recap.build(os.path.join(self.dir, "nope.db"), "run-1"))

    def test_separates_no_genre_from_a_genre_off_the_tree(self):
        """The two are fixed in the same editor but they are not the same
        problem, and the Metadata page counts them apart."""
        self._album(1, b"/music/a/cover.jpg")
        self._item(genres="French House")
        self._item(genres=None)
        self._item(genres="")
        self._item(genres="Totally Made Up Genre")

        recap = import_recap.build(self.db, "run-1")

        self.assertEqual(recap["withoutGenre"], 2)
        self.assertEqual(recap["offTree"], 1)

    def test_reads_the_primary_genre_out_of_the_delimited_column(self):
        """beets joins multi-valued genres in one column; taking the raw string
        would send every multi-genre track off-tree."""
        self._album(1, b"/music/a/cover.jpg")
        self._item(genres="French House\\␀Disco")

        self.assertEqual(import_recap.build(self.db, "run-1")["offTree"], 0)

    def test_counts_missing_years(self):
        self._album(1, b"/music/a/cover.jpg")
        self._item(year=2001)
        self._item(year=None)
        self._item(year=0)

        self.assertEqual(import_recap.build(self.db, "run-1")["withoutYear"], 2)

    def test_counts_the_albums_it_touched_and_the_ones_with_no_cover(self):
        self._album(1, b"/music/a/cover.jpg")
        self._album(2, None)
        self._album(3, b"/music/c/cover.jpg")
        self._item(album_id=1)
        self._item(album_id=2)
        self._item(album_id=3, batch="an-earlier-run")

        recap = import_recap.build(self.db, "run-1")

        self.assertEqual(recap["albums"], 2)
        self.assertEqual(recap["albumsWithoutArt"], 1)

    def test_judges_a_tracklist_on_the_whole_album_not_on_the_part_that_arrived(self):
        """An album the import merged into one already on the shelf has to be
        judged on all of its tracks, or a complete record reads as gapped."""
        self._album(1, b"/music/a/cover.jpg")
        self._item(track=1, tracktotal=2)
        self._item(track=2, tracktotal=2, batch="an-earlier-run")

        self.assertEqual(import_recap.build(self.db, "run-1")["albumsWithGaps"], 0)

    def test_finds_a_hole_in_the_sequence(self):
        self._album(1, b"/music/a/cover.jpg")
        self._item(track=1, tracktotal=3)
        self._item(track=3, tracktotal=3)

        self.assertEqual(import_recap.build(self.db, "run-1")["albumsWithGaps"], 1)

    def test_a_collection_has_no_tracklist_to_have_holes_in(self):
        """Same rule as the albums view: whatever a collection holds is what its
        owner put in it, so the recap must not report it as missing anything."""
        self._album(1, b"/music/a/cover.jpg")
        self._collection(1)
        self._item(track=1, tracktotal=3)
        self._item(track=3, tracktotal=3)

        self.assertEqual(import_recap.build(self.db, "run-1")["albumsWithGaps"], 0)


class GapsTest(unittest.TestCase):
    """Mirrors `hasTracklistGaps` in the albums view. Kept as its own case
    because the two implementations must agree and this is the cheap side."""

    def test_an_unnumbered_album_has_no_sequence_to_have_holes_in(self):
        self.assertFalse(import_recap.has_gaps(set(), 0))
        self.assertFalse(import_recap.has_gaps(set(), 12))

    def test_a_declared_total_beyond_what_is_present_is_a_gap(self):
        self.assertTrue(import_recap.has_gaps({1, 2}, 12))

    def test_the_highest_number_stands_in_for_a_total_nobody_declared(self):
        self.assertTrue(import_recap.has_gaps({1, 5}, 0))
        self.assertFalse(import_recap.has_gaps({1, 2, 3}, 0))


if __name__ == "__main__":
    unittest.main()
