import os
import shutil
import tempfile
import unittest

from beets.library import Item, Library

import album_kind
import library


class AlbumKindTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.db = os.path.join(self.dir, "library.db")
        lib = Library(self.db, directory=self.dir)
        self.album_ids = [
            lib.add_album([Item(path=f"/x/{name}.mp3".encode(), title=name)]).id
            for name in ("a", "b")
        ]
        lib._close()

    def _set(self, kind: str, album_ids) -> dict:
        params = {
            "beets_db": self.db,
            "library_dir": self.dir,
            "kind": kind,
            "album_ids": album_ids,
        }
        return album_kind.handle("req", params)

    def _kinds(self) -> list:
        lib = Library(self.db, directory=self.dir)
        try:
            return [lib.get_album(i).get(library.ALBUM_KIND_KEY) for i in self.album_ids]
        finally:
            lib._close()

    def test_every_row_of_a_card_changes_together(self):
        self.assertEqual(self._set("collection", self.album_ids), {"updated": 2})
        self.assertEqual(self._kinds(), ["collection", "collection"])

    def test_back_to_album_removes_the_attribute(self):
        self._set("collection", self.album_ids)
        self.assertEqual(self._set("album", self.album_ids[:1]), {"updated": 1})
        self.assertEqual(self._kinds(), [None, "collection"])

    def test_an_unchanged_or_missing_row_is_not_counted(self):
        self.assertEqual(self._set("album", [*self.album_ids, 999]), {"updated": 0})

    def test_an_unknown_kind_is_refused(self):
        with self.assertRaises(RuntimeError):
            self._set("playlist", self.album_ids)


if __name__ == "__main__":
    unittest.main()
