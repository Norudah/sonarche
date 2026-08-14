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


if __name__ == "__main__":
    unittest.main()
