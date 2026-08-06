import os
import sqlite3
import tempfile
import unittest

from library import (
    _apply_fields,
    update,
    _coerce_int,
    art_paths_by_album,
    expand_db_path,
    first_genre,
    flex_attrs_by_item,
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


def _db_with(items=(), albums=(), attributes=()):
    """In-memory beets-shaped DB holding only the columns the read path uses."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE albums (id INTEGER PRIMARY KEY, artpath BLOB)")
    conn.execute(
        "CREATE TABLE items (id INTEGER PRIMARY KEY, title TEXT, artist TEXT,"
        " album TEXT, albumartist TEXT, year INTEGER, genres TEXT, track INTEGER,"
        " tracktotal INTEGER, length REAL, bitrate INTEGER, format TEXT,"
        " path BLOB, album_id INTEGER, added REAL, mb_trackid TEXT,"
        " grouping TEXT, albumtypes TEXT)"
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
            " track, tracktotal, length, bitrate, format, path, album_id, added, mb_trackid,"
            " grouping, albumtypes)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            item,
        )
    return conn


def _item(
    item_id=1, album_id=1, genres=None, length=200.05, added=100.0, year=2014,
    mb_trackid="", grouping="", albumtypes="",
):
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
        mb_trackid,
        grouping,
        albumtypes,
    )


class ArtPathsByAlbumTest(unittest.TestCase):
    def test_resolves_relative_artpath_against_library_dir(self):
        conn = _db_with(albums=[(1, b"Artist/Album/cover.jpg")])

        mapping = art_paths_by_album(conn, "/music")

        self.assertEqual(mapping, {1: os.path.normpath("/music/Artist/Album/cover.jpg")})

    def test_album_without_art_maps_to_none(self):
        conn = _db_with(albums=[(1, None)])

        self.assertEqual(art_paths_by_album(conn, "/music"), {1: None})

    def test_archived_hq_cover_is_not_what_the_ui_gets(self):
        """The 500px rendition is the display path even when the CAA original
        sits right next to it: the UI draws covers at 384px at the very most,
        and a 5000px original costs ~100 MB of bitmap to do it."""
        with tempfile.TemporaryDirectory() as art_dir:
            artpath = os.path.join(art_dir, "cover.jpg")
            open(artpath, "wb").close()
            open(os.path.join(art_dir, "cover-hq.jpg"), "wb").close()
            conn = _db_with(albums=[(1, artpath.encode())])

            self.assertEqual(art_paths_by_album(conn, "/music"), {1: artpath})

    def test_unknown_album_id_misses_rather_than_raising(self):
        """A singleton has no album_id; the lookup must return None, not blow up."""
        mapping = art_paths_by_album(_db_with(albums=[(1, None)]), "/music")

        self.assertIsNone(mapping.get(None))
        self.assertIsNone(mapping.get(999))


class FlexAttrsTest(unittest.TestCase):
    def test_reads_only_the_requested_key(self):
        conn = _db_with(
            attributes=[
                (1, "sonarche_bonus_source", "Deluxe Edition"),
                (1, "data_source", "MusicBrainz"),
                (2, "sonarche_suspect_match", "title-mismatch"),
            ]
        )

        self.assertEqual(
            flex_attrs_by_item(conn, "sonarche_bonus_source"), {1: "Deluxe Edition"}
        )
        self.assertEqual(
            flex_attrs_by_item(conn, "sonarche_suspect_match"), {2: "title-mismatch"}
        )

    def test_empty_value_is_dropped(self):
        conn = _db_with(attributes=[(1, "sonarche_bonus_source", "")])

        self.assertEqual(flex_attrs_by_item(conn, "sonarche_bonus_source"), {})


class TrackRowTest(unittest.TestCase):
    def _row(self, **kwargs):
        conn = _db_with(items=[_item(**kwargs)])
        return conn.execute("SELECT * FROM items").fetchone()

    def test_maps_the_wire_shape(self):
        row = self._row(genres="Pop\\␀Teen Pop")

        out = track_row(row, {1: "/music/cover.jpg"}, {}, {}, {}, {}, "/music")

        self.assertEqual(out["id"], 1)
        self.assertEqual(out["album_artist"], "One Direction")
        self.assertEqual(out["genre"], "Pop")
        self.assertEqual(out["art_path"], "/music/cover.jpg")
        self.assertEqual(out["path"], os.path.normpath(
            "/music/One Direction/Four/03 Night Changes.m4a"
        ))

    def test_length_is_rounded_to_one_decimal(self):
        out = track_row(self._row(length=200.05), {}, {}, {}, {}, {}, "/music")

        self.assertEqual(out["length"], 200.1)

    def test_zero_length_yields_none_not_zero(self):
        """A track with no stored duration must read as unknown, so the front
        falls back to the audio element rather than showing 0:00."""
        out = track_row(self._row(length=0), {}, {}, {}, {}, {}, "/music")

        self.assertIsNone(out["length"])

    def test_zero_year_yields_none(self):
        self.assertIsNone(track_row(self._row(year=0), {}, {}, {}, {}, {}, "/music")["year"])

    def test_mb_trackid_surfaces_and_empty_reads_as_none(self):
        matched = track_row(self._row(mb_trackid="rec-1"), {}, {}, {}, {}, {}, "/music")
        unmatched = track_row(self._row(mb_trackid=""), {}, {}, {}, {}, {}, "/music")

        self.assertEqual(matched["mb_trackid"], "rec-1")
        self.assertIsNone(unmatched["mb_trackid"])

    def test_suspect_match_is_attached_by_item_id(self):
        row = self._row(item_id=7)

        flagged = track_row(row, {}, {}, {}, {7: "title-mismatch"}, {}, "/music")
        clean = track_row(row, {}, {}, {}, {8: "title-mismatch"}, {}, "/music")

        self.assertTrue(flagged["suspect_match"])
        self.assertFalse(clean["suspect_match"])

    def test_provisional_cover_is_attached_by_item_id(self):
        row = self._row(item_id=7)

        flagged = track_row(row, {}, {}, {}, {}, {7: "1"}, "/music")
        clean = track_row(row, {}, {}, {}, {}, {8: "1"}, "/music")

        self.assertTrue(flagged["provisional_cover"])
        self.assertFalse(clean["provisional_cover"])

    def test_bonus_source_is_attached_by_item_id(self):
        row = self._row(item_id=7)

        out = track_row(row, {}, {}, {7: "Deluxe Edition"}, {}, {}, "/music")

        self.assertEqual(out["bonus_source"], "Deluxe Edition")

    def test_missing_bonus_source_is_none(self):
        out = track_row(self._row(item_id=7), {}, {}, {8: "Other"}, {}, {}, "/music")

        self.assertIsNone(out["bonus_source"])

    def test_category_surfaces_and_empty_reads_as_none(self):
        tagged = track_row(self._row(grouping="Video Games"), {}, {}, {}, {}, {}, "/music")
        bare = track_row(self._row(grouping=""), {}, {}, {}, {}, {}, "/music")

        self.assertEqual(tagged["category"], "Video Games")
        self.assertIsNone(bare["category"])

    def test_soundtrack_release_type_is_flagged(self):
        ost = track_row(self._row(albumtypes="album; soundtrack"), {}, {}, {}, {}, {}, "/music")
        plain = track_row(self._row(albumtypes="album"), {}, {}, {}, {}, {}, "/music")

        self.assertTrue(ost["soundtrack"])
        self.assertFalse(plain["soundtrack"])

    def test_track_without_album_gets_no_art(self):
        out = track_row(self._row(album_id=None), {1: "/music/cover.jpg"}, {}, {}, {}, {}, "/music")

        self.assertIsNone(out["art_path"])


class _FakeItem:
    """Enough of a beets Item for _apply_fields: attribute get/set plus the
    multi-valued `genres` accessor it reads through `.get(...)`."""

    def __init__(self, **attrs):
        self.__dict__.update(attrs)

    def get(self, key, with_album=True):
        return self.__dict__.get(key)


class CoerceIntTest(unittest.TestCase):
    def test_empty_clears_to_zero(self):
        self.assertEqual(_coerce_int(""), 0)
        self.assertEqual(_coerce_int("   "), 0)

    def test_numeric_string_parses(self):
        self.assertEqual(_coerce_int("2015"), 2015)
        self.assertEqual(_coerce_int(" 3 "), 3)

    def test_non_numeric_signals_skip(self):
        self.assertIsNone(_coerce_int("mmxv"))


class ApplyFieldsTest(unittest.TestCase):
    def _item(self, **overrides):
        base = dict(
            title="Old", artist="A", albumartist="A", album="Rec",
            year=2014, track=3, tracktotal=12, genres=["Pop"],
        )
        base.update(overrides)
        return _FakeItem(**base)

    def test_returns_false_when_nothing_changes(self):
        item = self._item()
        self.assertFalse(_apply_fields(item, {"title": "Old", "year": "2014"}))

    def test_changes_only_the_provided_fields(self):
        item = self._item()
        self.assertTrue(_apply_fields(item, {"title": "New"}))
        self.assertEqual(item.title, "New")
        self.assertEqual(item.artist, "A")

    def test_text_field_is_trimmed(self):
        item = self._item()
        _apply_fields(item, {"artist": "  Beyoncé  "})
        self.assertEqual(item.artist, "Beyoncé")

    def test_emptied_int_clears_to_zero(self):
        item = self._item()
        self.assertTrue(_apply_fields(item, {"year": ""}))
        self.assertEqual(item.year, 0)

    def test_invalid_int_is_skipped_not_fatal(self):
        item = self._item()
        self.assertFalse(_apply_fields(item, {"year": "nope"}))
        self.assertEqual(item.year, 2014)

    def test_genre_collapses_to_the_edited_value(self):
        item = self._item(genres=["Pop", "Teen Pop"])
        self.assertTrue(_apply_fields(item, {"genre": "Rock"}))
        self.assertEqual(item.genres, ["Rock"])

    def test_genre_splits_a_pasted_multi_value(self):
        item = self._item()
        _apply_fields(item, {"genre": "Rock; Metal"})
        self.assertEqual(item.genres, ["Rock", "Metal"])

    def test_cleared_genre_becomes_empty_list(self):
        item = self._item()
        self.assertTrue(_apply_fields(item, {"genre": ""}))
        self.assertEqual(item.genres, [])

    def test_unchanged_genre_is_left_alone(self):
        item = self._item(genres=["Pop"])
        self.assertFalse(_apply_fields(item, {"genre": "Pop"}))

    def test_reports_the_item_attributes_that_moved(self):
        """The returned names feed the provenance trail — the genre edit must
        surface as beets' `genres`, the attribute it actually lands on."""
        item = self._item()
        self.assertEqual(
            _apply_fields(item, {"title": "New", "artist": "A", "year": "2015", "genre": "Rock"}),
            {"title", "year", "genres"},
        )

    def test_category_lands_on_grouping(self):
        item = self._item(grouping="")
        self.assertEqual(_apply_fields(item, {"grouping": "Video Games"}), {"grouping"})
        self.assertEqual(item.grouping, "Video Games")


class UpdateMovesTheFileTest(unittest.TestCase):
    """Regression: renaming an album or its artist left the file under the old
    folder. The database said one thing and the disk another, and only a real
    move on a real file can prove that fixed."""

    def setUp(self):
        import struct

        self.root = tempfile.mkdtemp()
        self.music = os.path.join(self.root, "music")
        os.makedirs(self.music)
        self.db = os.path.join(self.root, "library.db")

        source = os.path.join(self.root, "track.wav")
        rate, seconds = 8000, 1
        data = b"\x00\x00" * rate * seconds
        header = (
            b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVEfmt "
            + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16)
            + b"data" + struct.pack("<I", len(data))
        )
        with open(source, "wb") as handle:
            handle.write(header + data)

        from beets.library import Item, Library

        lib = Library(self.db, directory=self.music)
        item = Item.from_path(source)
        item.albumartist = "Old Artist"
        item.artist = "Old Artist"
        item.album = "Old Album"
        item.title = "Track"
        item.track = 1
        lib.add(item)
        lib.add_album([item])
        item.move()
        self.item_id = item.id
        self.old_path = item.filepath
        lib._close()

    def _update(self, fields):
        return update(
            "req",
            {
                "beets_db": self.db,
                "library_dir": self.music,
                "updates": [{"id": self.item_id, "fields": fields}],
            },
        )

    def _current_path(self):
        from beets.library import Library

        lib = Library(self.db, directory=self.music)
        try:
            return str(lib.get_item(self.item_id).filepath)
        finally:
            lib._close()

    def test_renaming_the_album_refiles_the_track(self):
        self.assertEqual(self._update({"album": "New Album"}), {"updated": 1, "artist_renames": []})

        moved = self._current_path()
        self.assertIn(os.path.join("Old Artist", "New Album"), moved)
        self.assertTrue(os.path.exists(moved))
        self.assertFalse(os.path.exists(self.old_path), "the old file must not linger")

    def test_renaming_the_album_artist_refiles_the_track(self):
        self.assertEqual(
            self._update({"albumartist": "New Artist"}),
            {"updated": 1, "artist_renames": [{"old": "Old Artist", "new": "New Artist"}]},
        )

        moved = self._current_path()
        self.assertIn(os.path.join("New Artist", "Old Album"), moved)
        self.assertTrue(os.path.exists(moved))

    def test_a_rename_to_the_same_name_reports_no_artist_rename(self):
        """A no-op edit must not surface as a rename: Rust would move the
        artist's image onto itself, or worse, orphan it."""
        self.assertEqual(self._update({"albumartist": "Old Artist"}), {"updated": 0, "artist_renames": []})

    def test_the_emptied_folder_does_not_survive(self):
        self._update({"album": "New Album"})

        self.assertFalse(
            os.path.isdir(os.path.join(self.music, "Old Artist", "Old Album")),
            "a husk folder makes the library look like it holds two albums",
        )

    def test_an_edit_that_changes_no_filing_field_leaves_the_path_alone(self):
        before = self._current_path()

        self.assertEqual(self._update({"year": "2011"}), {"updated": 1, "artist_renames": []})

        self.assertEqual(self._current_path(), before)


if __name__ == "__main__":
    unittest.main()
