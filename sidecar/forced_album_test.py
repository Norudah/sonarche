import os
import shutil
import struct
import tempfile
import unittest

import forced_album


class RequestedTest(unittest.TestCase):
    def test_reads_a_forced_album_off_the_params(self):
        spec = forced_album.requested(
            {"forced_album": {"title": "Inception", "artist": "Hans Zimmer", "category": "Film"}}
        )
        self.assertEqual(spec["title"], "Inception")
        self.assertEqual(spec["artist"], "Hans Zimmer")
        self.assertEqual(spec["category"], "Film")

    def test_falls_back_to_the_compilation_artist(self):
        spec = forced_album.requested({"forced_album": {"title": "Arcane"}})
        self.assertEqual(spec["artist"], forced_album.DEFAULT_ARTIST)

    def test_a_blank_title_is_not_a_forced_album(self):
        # The toggle can be on with the field still empty; that must download
        # normally rather than fail.
        self.assertIsNone(forced_album.requested({"forced_album": {"title": "   "}}))
        self.assertIsNone(forced_album.requested({}))

    def test_trims_what_the_user_typed(self):
        spec = forced_album.requested({"forced_album": {"title": "  Tron  ", "artist": " Daft Punk "}})
        self.assertEqual(spec["title"], "Tron")
        self.assertEqual(spec["artist"], "Daft Punk")


class MediaCategoryTest(unittest.TestCase):
    def test_a_medium_has_a_soundtrack_to_look_up(self):
        for category in ("Film", "Series", "Video Games", "Anime", "Cartoon", "Musical"):
            self.assertTrue(forced_album.is_media_category(category), category)

    def test_plain_music_and_no_category_have_none(self):
        self.assertFalse(forced_album.is_media_category("Music"))
        self.assertFalse(forced_album.is_media_category(""))
        self.assertFalse(forced_album.is_media_category(None))


class TitleMatchTest(unittest.TestCase):
    def test_matches_a_soundtrack_release_group_to_its_media(self):
        self.assertTrue(
            forced_album.title_matches("Inception (Original Motion Picture Soundtrack)", "Inception")
        )
        self.assertTrue(
            forced_album.title_matches("Arcane: Music From the Animated Series", "Arcane")
        )

    def test_ignores_case_accents_and_punctuation(self):
        self.assertTrue(forced_album.title_matches("Amelie - Original Soundtrack", "amélie"))

    def test_refuses_a_release_group_about_something_else(self):
        self.assertFalse(forced_album.title_matches("Inception Soundtrack", "Interstellar"))

    def test_will_not_match_on_a_word_buried_mid_title(self):
        # A bare substring test would hand "Her" every title containing it.
        self.assertFalse(forced_album.title_matches("Music for Her Majesty", "Her"))

    def test_refuses_a_title_too_short_to_mean_anything(self):
        self.assertFalse(forced_album.title_matches("Up (Original Soundtrack)", "Up"))


class NumberingTest(unittest.TestCase):
    def test_numbers_the_playlist_in_order_from_one(self):
        self.assertEqual(forced_album.numbering([42, 7, 13]), {42: 1, 7: 2, 13: 3})

    def test_has_nothing_to_number_in_an_empty_album(self):
        self.assertEqual(forced_album.numbering([]), {})


class ApplyTest(unittest.TestCase):
    """The whole point of the feature, on a real library: three tracks that each
    matched a different release end up as one record, in one folder, numbered in
    playlist order — and the rows they left behind are gone, because a leftover
    empty row is what makes beets suffix the folder with %aunique."""

    def setUp(self):
        self.root = tempfile.mkdtemp()
        self.music = os.path.join(self.root, "music")
        os.makedirs(self.music)
        self.db = os.path.join(self.root, "library.db")

        from beets.library import Item, Library

        lib = Library(self.db, directory=self.music)
        self.item_ids = []
        for index, (artist, album, title) in enumerate(
            [
                ("Hans Zimmer", "Inception OST", "Time"),
                ("Lisa Gerrard", "Duality", "Now We Are Free"),
                ("Ludwig Goransson", "Tenet", "Rainy Night"),
            ],
            start=1,
        ):
            item = Item.from_path(self._wav(f"track{index}.wav"))
            item.artist = artist
            item.albumartist = artist
            item.album = album
            item.title = title
            # Each arrives numbered by its *own* release — 4, 2, 9, not 1, 2, 3.
            item.track = index * 3 + 1
            item.mb_albumid = f"release-{index}"
            lib.add(item)
            lib.add_album([item])
            item.move()
            self.item_ids.append(item.id)
        lib._close()

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def _wav(self, name):
        path = os.path.join(self.root, name)
        rate = 8000
        data = b"\x00\x00" * rate
        header = (
            b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVEfmt "
            + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16)
            + b"data" + struct.pack("<I", len(data))
        )
        with open(path, "wb") as handle:
            handle.write(header + data)
        return path

    def _apply(self):
        from beets.library import Library

        lib = Library(self.db, directory=self.music)
        try:
            items = [lib.get_item(item_id) for item_id in self.item_ids]
            album = forced_album.apply(
                lib, items, {"title": "Inception", "artist": "Various Artists"}
            )
            return lib, album
        finally:
            pass

    def test_files_every_track_under_the_one_album(self):
        lib, album = self._apply()
        try:
            self.assertEqual(album.album, "Inception")
            self.assertEqual(album.albumartist, "Various Artists")
            for item_id in self.item_ids:
                fresh = lib.get_item(item_id)
                self.assertEqual(fresh.album, "Inception")
                self.assertEqual(fresh.albumartist, "Various Artists")
                self.assertEqual(fresh.album_id, album.id)
        finally:
            lib._close()

    def test_renumbers_in_playlist_order(self):
        lib, _ = self._apply()
        try:
            numbers = [lib.get_item(item_id).track for item_id in self.item_ids]
            self.assertEqual(numbers, [1, 2, 3])
            self.assertEqual({lib.get_item(i).tracktotal for i in self.item_ids}, {3})
        finally:
            lib._close()

    def test_keeps_each_track_its_own_artist(self):
        # The reason to pay for identification at all: the album is the user's,
        # the performers are not.
        lib, _ = self._apply()
        try:
            artists = [lib.get_item(item_id).artist for item_id in self.item_ids]
            self.assertEqual(artists, ["Hans Zimmer", "Lisa Gerrard", "Ludwig Goransson"])
        finally:
            lib._close()

    def test_drops_the_rows_the_tracks_left(self):
        lib, album = self._apply()
        try:
            self.assertEqual([row.id for row in lib.albums()], [album.id])
        finally:
            lib._close()

    def test_moves_every_file_into_one_unsuffixed_folder(self):
        lib, _ = self._apply()
        try:
            folders = set()
            for item_id in self.item_ids:
                path = str(lib.get_item(item_id).filepath)
                self.assertTrue(os.path.exists(path), path)
                folders.add(os.path.dirname(path))
            self.assertEqual(len(folders), 1)
            folder = folders.pop()
            self.assertEqual(
                os.path.join("Various Artists", "Inception"),
                os.path.join(os.path.basename(os.path.dirname(folder)), os.path.basename(folder)),
            )
        finally:
            lib._close()

    def test_forgets_the_release_each_track_was_filed_under(self):
        # mb_trackid is the recording and stays; mb_albumid said where the file
        # belonged, and it no longer belongs there.
        lib, album = self._apply()
        try:
            for item_id in self.item_ids:
                self.assertFalse(lib.get_item(item_id).mb_albumid)
            self.assertFalse(album.mb_albumid)
        finally:
            lib._close()


if __name__ == "__main__":
    unittest.main()
