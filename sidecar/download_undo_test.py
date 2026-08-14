import os
import shutil
import tempfile
import unittest

from beets.library import Item, Library

import download_undo


class DownloadUndoTest(unittest.TestCase):
    """Against a real beets library, like the import undo's tests: what matters
    is what beets' removal does around the ids — album rows, covers, pruning."""

    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.db = os.path.join(self.dir, "library.db")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def _file(self, name: str) -> bytes:
        path = os.path.join(self.dir, name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(b"audio")
        return path.encode()

    def _params(self, item_ids: list[int]) -> dict:
        return {"beets_db": self.db, "library_dir": self.dir, "item_ids": item_ids}

    def test_removes_the_jobs_tracks_and_their_album(self):
        lib = Library(self.db, directory=self.dir)
        album = lib.add_album(
            [Item(path=self._file(f"Pile/{n}.mp3"), title=f"t{n}") for n in (1, 2)]
        )
        ids = [item.id for item in album.items()]
        lib._close()

        result = download_undo.handle("req", self._params(ids))

        self.assertEqual(result["removed"], 2)
        self.assertEqual(result["foreign"], 0)
        lib = Library(self.db, directory=self.dir)
        self.assertEqual(len(list(lib.items())), 0)
        self.assertEqual(len(list(lib.albums())), 0)
        lib._close()
        self.assertFalse(os.path.exists(os.path.join(self.dir, "Pile")))

    def test_an_album_the_download_only_added_to_survives(self):
        lib = Library(self.db, directory=self.dir)
        mine = Item(path=self._file("Kid A/1.mp3"), title="Everything", album="Kid A")
        theirs = Item(path=self._file("Kid A/2.mp3"), title="Kid A", album="Kid A")
        lib.add_album([mine, theirs])
        lib._close()

        preview = download_undo.preview("req", self._params([mine.id]))
        self.assertEqual(preview["tracks"], 1)
        self.assertEqual(preview["albumsRemoved"], 0)
        self.assertEqual(preview["albumsKept"], 1)

        download_undo.handle("req", self._params([mine.id]))

        lib = Library(self.db, directory=self.dir)
        self.assertEqual([item.title for item in lib.items()], ["Kid A"])
        self.assertEqual(len(list(lib.albums())), 1)
        lib._close()

    def test_an_id_already_deleted_by_hand_does_not_count(self):
        lib = Library(self.db, directory=self.dir)
        item = Item(path=self._file("Loose/1.mp3"), title="loose")
        lib.add(item)
        lib._close()

        preview = download_undo.preview("req", self._params([item.id, 9999]))
        self.assertEqual(preview["tracks"], 1)

        result = download_undo.handle("req", self._params([item.id, 9999]))
        self.assertEqual(result["removed"], 1)

    def test_a_file_outside_the_library_keeps_its_file(self):
        outside = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, outside, True)
        path = os.path.join(outside, "stranger.mp3")
        with open(path, "wb") as fh:
            fh.write(b"audio")

        lib = Library(self.db, directory=self.dir)
        item = Item(path=path.encode(), title="stranger")
        lib.add(item)
        lib._close()

        result = download_undo.handle("req", self._params([item.id]))

        self.assertEqual(result["foreign"], 1)
        self.assertTrue(os.path.exists(path))
        lib = Library(self.db, directory=self.dir)
        self.assertEqual(len(list(lib.items())), 0)
        lib._close()


if __name__ == "__main__":
    unittest.main()
