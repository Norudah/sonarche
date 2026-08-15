import os
import shutil
import tempfile
import unittest

from beets.library import Item, Library

import relayout


class RelayoutTest(unittest.TestCase):
    """Against a real beets library: the pass is nothing but what beets does
    when asked to move everything — files landing where the current templates
    say, art riding along, old folders pruned."""

    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.db = os.path.join(self.dir, "library.db")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def _file(self, name: str) -> str:
        path = os.path.join(self.dir, name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(b"audio")
        return path

    def _run(self) -> dict:
        return relayout.handle("req", {"beets_db": self.db, "library_dir": self.dir})

    def test_a_misfiled_album_moves_to_where_the_templates_point(self):
        """Simulates the pre-zones layout: the file sits somewhere the current
        templates would never put it, and only a move recomputes it."""
        lib = Library(self.db, directory=self.dir)
        item = Item(
            path=self._file("old spot/1 Holiday.mp3"),
            format="MP3",
            title="Holiday",
            track=1,
            album="American Idiot",
            albumartist="Green Day",
        )
        album = lib.add_album([item])
        art = self._file("old spot/cover.jpg")
        album.artpath = art.encode()
        album.store(inherit=False)

        report = self._run()

        self.assertEqual(report["albums"], 1)
        fresh = lib.get_item(item.id)
        # The test env runs beets' stock templates; the app config's zones are
        # pinned in import_paths_test. What matters here is the re-file itself.
        self.assertIn(os.path.join("Green Day", "American Idiot"), fresh.path.decode())
        self.assertTrue(os.path.exists(fresh.path.decode()))
        moved_art = lib.get_album(album.id).artpath.decode()
        self.assertEqual(os.path.dirname(moved_art), os.path.dirname(fresh.path.decode()))
        self.assertFalse(os.path.exists(os.path.join(self.dir, "old spot")))
        lib._close()

    def test_a_rowless_singleton_moves_too(self):
        lib = Library(self.db, directory=self.dir)
        item = Item(
            path=self._file("wrong/track.mp3"),
            format="MP3",
            title="Mamma Mia - I Do",
            artist="LIVinglife",
        )
        lib.add(item)

        report = self._run()

        self.assertEqual(report["singles"], 1)
        fresh = lib.get_item(item.id)
        self.assertIn("Non-Album", fresh.path.decode())
        lib._close()

    def test_a_file_already_in_place_is_left_alone(self):
        lib = Library(self.db, directory=self.dir)
        item = Item(
            path=self._file("Green Day/American Idiot/01 Holiday.mp3"),
            format="MP3",
            title="Holiday",
            track=1,
            album="American Idiot",
            albumartist="Green Day",
        )
        lib.add_album([item])
        before = lib.get_item(item.id).path

        self._run()

        self.assertEqual(lib.get_item(item.id).path, before)
        lib._close()



    def test_no_database_means_no_pass_and_no_database(self):
        """First run or post-erase: opening the Library would create an empty
        beets db every "does the user have a library" check then believes in."""
        report = self._run()
        self.assertEqual(report, {"albums": 0, "singles": 0, "dissolved": 0})
        self.assertFalse(os.path.exists(self.db))

    def test_a_blank_row_dissolves_instead_of_relayouting_as_unknown_album(self):
        """The legacy guessed-single filing: a blank-titled row whose folder
        %aunique could only name by row id. Re-filing it would park it as
        Library/Unknown Artist/Unknown Album for good; dissolving it hands the
        items back to the singleton path, where the provisional flag routes."""
        lib = Library(self.db, directory=self.dir)
        item = Item(
            path=self._file("LIVinglife/_86/track.mp3"),
            format="MP3",
            title="Mamma Mia - I Do",
            artist="LIVinglife",
        )
        row = lib.add_album([item])
        self.assertEqual(str(row.album), "")

        report = self._run()

        self.assertEqual(report["dissolved"], 1)
        self.assertIsNone(lib.get_album(row.id))
        fresh = lib.get_item(item.id)
        self.assertIsNone(fresh.album_id)
        # Test env runs beets' stock templates; what matters is the re-file.
        self.assertIn("Non-Album", fresh.path.decode())
        lib._close()

    def test_a_singletons_written_out_cover_follows_its_file(self):
        import library as library_mod

        lib = Library(self.db, directory=self.dir)
        item = Item(
            path=self._file("wrong/track.mp3"),
            format="MP3",
            title="Mamma Mia - I Do",
            artist="LIVinglife",
        )
        lib.add(item)
        art = self._file("wrong/track.jpg")
        item[library_mod.ITEM_ART_KEY] = art
        item.store()

        self._run()

        fresh = lib.get_item(item.id)
        followed = fresh.get(library_mod.ITEM_ART_KEY)
        self.assertEqual(os.path.dirname(followed), os.path.dirname(fresh.path.decode()))
        self.assertTrue(os.path.exists(followed))
        lib._close()
        self.assertFalse(os.path.exists(os.path.join(self.dir, "wrong")))


if __name__ == "__main__":
    unittest.main()
