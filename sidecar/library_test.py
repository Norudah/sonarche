import os
import sqlite3
import tempfile
import unittest

from library import (
    _art_path,
    art_paths_by_album,
    bonus_sources_by_item,
    expand_db_path,
    first_genre,
    track_row,
)


class ExpandDbPathTest(unittest.TestCase):
    """Beets stores paths relative to the library dir, POSIX-separated. Getting
    this wrong yields paths that look right and resolve to nothing."""

    def test_relative_path_is_joined_to_library_dir(self):
        self.assertEqual(
            expand_db_path(b"Artist/Album/01 Track.m4a", "/music"),
            os.path.normpath("/music/Artist/Album/01 Track.m4a"),
        )

    def test_absolute_path_is_left_alone(self):
        """Files outside the library dir are stored absolute already."""
        self.assertEqual(
            expand_db_path(b"/elsewhere/track.m4a", "/music"), "/elsewhere/track.m4a"
        )

    def test_posix_separator_is_translated(self):
        expanded = expand_db_path(b"Artist/Album/track.m4a", "/music")
        self.assertNotIn("/", expanded[len("/music") :].replace(os.sep, ""))

    def test_empty_and_none_yield_none(self):
        self.assertIsNone(expand_db_path(None, "/music"))
        self.assertIsNone(expand_db_path(b"", "/music"))


class FirstGenreTest(unittest.TestCase):
    def test_splits_on_beets_db_delimiter(self):
        self.assertEqual(first_genre("Dark Wave\\␀Industrial\\␀Electronic Rock"), "Dark Wave")

    def test_falls_back_to_display_delimiter(self):
        """Values read from a file's own tags use '; ' instead."""
        self.assertEqual(first_genre("Industrial; Metal"), "Industrial")

    def test_single_genre_passes_through(self):
        self.assertEqual(first_genre("Jazz"), "Jazz")

    def test_empty_yields_none(self):
        self.assertIsNone(first_genre(None))
        self.assertIsNone(first_genre(""))

    def test_leading_blank_segment_is_skipped(self):
        self.assertEqual(first_genre("\\␀Metal"), "Metal")


class ArtPathTest(unittest.TestCase):
    def test_prefers_hq_cover_next_to_artpath(self):
        with tempfile.TemporaryDirectory() as art_dir:
            artpath = os.path.join(art_dir, "cover.jpg")
            hq = os.path.join(art_dir, "cover-hq.jpg")
            open(artpath, "wb").close()
            open(hq, "wb").close()

            self.assertEqual(_art_path(artpath), hq)

    def test_falls_back_to_artpath_without_hq(self):
        with tempfile.TemporaryDirectory() as art_dir:
            artpath = os.path.join(art_dir, "cover.jpg")
            open(artpath, "wb").close()

            self.assertEqual(_art_path(artpath), artpath)

    def test_no_artpath_yields_none(self):
        self.assertIsNone(_art_path(None))


def _db_with(items=(), albums=(), attributes=()):
    """In-memory beets-shaped DB holding only the columns the read path uses."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE albums (id INTEGER PRIMARY KEY, artpath BLOB)")
    conn.execute(
        "CREATE TABLE items (id INTEGER PRIMARY KEY, title TEXT, artist TEXT,"
        " album TEXT, albumartist TEXT, year INTEGER, genres TEXT, track INTEGER,"
        " tracktotal INTEGER, length REAL, bitrate INTEGER, format TEXT,"
        " path BLOB, album_id INTEGER, added REAL)"
    )
    conn.execute(
        "CREATE TABLE item_attributes (entity_id INTEGER, key TEXT, value TEXT)"
    )
    conn.executemany("INSERT INTO albums (id, artpath) VALUES (?, ?)", albums)
    conn.executemany(
        "INSERT INTO item_attributes (entity_id, key, value) VALUES (?, ?, ?)",
        attributes,
    )
    for item in items:
        conn.execute(
            "INSERT INTO items (id, title, artist, album, albumartist, year, genres,"
            " track, tracktotal, length, bitrate, format, path, album_id, added)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            item,
        )
    return conn


def _item(item_id=1, album_id=1, genres=None, length=200.05, added=100.0, year=2014):
    return (
        item_id,
        "Night Changes",
        "One Direction",
        "Four",
        "One Direction",
        year,
        genres,
        3,
        12,
        length,
        256000,
        "AAC",
        b"One Direction/Four/03 Night Changes.m4a",
        album_id,
        added,
    )


class ArtPathsByAlbumTest(unittest.TestCase):
    def test_resolves_relative_artpath_against_library_dir(self):
        conn = _db_with(albums=[(1, b"Artist/Album/cover.jpg")])

        mapping = art_paths_by_album(conn, "/music")

        self.assertEqual(mapping, {1: os.path.normpath("/music/Artist/Album/cover.jpg")})

    def test_album_without_art_maps_to_none(self):
        conn = _db_with(albums=[(1, None)])

        self.assertEqual(art_paths_by_album(conn, "/music"), {1: None})

    def test_unknown_album_id_misses_rather_than_raising(self):
        """A singleton has no album_id; the lookup must return None, not blow up."""
        mapping = art_paths_by_album(_db_with(albums=[(1, None)]), "/music")

        self.assertIsNone(mapping.get(None))
        self.assertIsNone(mapping.get(999))


class BonusSourcesTest(unittest.TestCase):
    def test_reads_only_the_bonus_source_key(self):
        conn = _db_with(
            attributes=[
                (1, "sonarche_bonus_source", "Deluxe Edition"),
                (1, "data_source", "MusicBrainz"),
                (2, "art_source", "coverart"),
            ]
        )

        self.assertEqual(bonus_sources_by_item(conn), {1: "Deluxe Edition"})

    def test_empty_value_is_dropped(self):
        conn = _db_with(attributes=[(1, "sonarche_bonus_source", "")])

        self.assertEqual(bonus_sources_by_item(conn), {})


class TrackRowTest(unittest.TestCase):
    def _row(self, **kwargs):
        conn = _db_with(items=[_item(**kwargs)])
        return conn.execute("SELECT * FROM items").fetchone()

    def test_maps_the_wire_shape(self):
        row = self._row(genres="Pop\\␀Teen Pop")

        out = track_row(row, {1: "/music/cover.jpg"}, {}, "/music")

        self.assertEqual(out["id"], 1)
        self.assertEqual(out["album_artist"], "One Direction")
        self.assertEqual(out["genre"], "Pop")
        self.assertEqual(out["art_path"], "/music/cover.jpg")
        self.assertEqual(out["path"], os.path.normpath(
            "/music/One Direction/Four/03 Night Changes.m4a"
        ))

    def test_length_is_rounded_to_one_decimal(self):
        out = track_row(self._row(length=200.05), {}, {}, "/music")

        self.assertEqual(out["length"], 200.1)

    def test_zero_length_yields_none_not_zero(self):
        """A track with no stored duration must read as unknown, so the front
        falls back to the audio element rather than showing 0:00."""
        out = track_row(self._row(length=0), {}, {}, "/music")

        self.assertIsNone(out["length"])

    def test_zero_year_yields_none(self):
        self.assertIsNone(track_row(self._row(year=0), {}, {}, "/music")["year"])

    def test_bonus_source_is_attached_by_item_id(self):
        row = self._row(item_id=7)

        out = track_row(row, {}, {7: "Deluxe Edition"}, "/music")

        self.assertEqual(out["bonus_source"], "Deluxe Edition")

    def test_missing_bonus_source_is_none(self):
        out = track_row(self._row(item_id=7), {}, {8: "Other"}, "/music")

        self.assertIsNone(out["bonus_source"])

    def test_track_without_album_gets_no_art(self):
        out = track_row(self._row(album_id=None), {1: "/music/cover.jpg"}, {}, "/music")

        self.assertIsNone(out["art_path"])


if __name__ == "__main__":
    unittest.main()
