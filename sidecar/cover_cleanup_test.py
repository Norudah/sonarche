import os
import sqlite3
import tempfile
import unittest

import cover_cleanup


class CoverCleanupTest(unittest.TestCase):
    """The one-shot sweep of <= 2.x archives: driven by the albums table, so it
    only ever reaches into folders the library itself points at."""

    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.db = os.path.join(self.dir.name, "library.db")

    def _album(self, folder: str, art_name: str = "cover.jpg") -> str:
        album_dir = os.path.join(self.dir.name, folder)
        os.makedirs(album_dir, exist_ok=True)
        art = os.path.join(album_dir, art_name)
        with open(art, "wb") as f:
            f.write(b"x")
        return art

    def _write_db(self, artpaths: list[str | None]) -> None:
        conn = sqlite3.connect(self.db)
        conn.execute("CREATE TABLE albums (id INTEGER PRIMARY KEY, artpath BLOB)")
        for artpath in artpaths:
            conn.execute(
                "INSERT INTO albums (artpath) VALUES (?)",
                (artpath.encode() if artpath else None,),
            )
        conn.commit()
        conn.close()

    def test_removes_archives_in_album_folders_only(self):
        art = self._album("Kid A")
        with open(os.path.join(os.path.dirname(art), "cover-hq.jpg"), "wb") as f:
            f.write(b"big")
        # A stray archive outside any album folder is not ours to touch.
        stray_dir = os.path.join(self.dir.name, "Not An Album")
        os.makedirs(stray_dir)
        stray = os.path.join(stray_dir, "cover-hq.jpg")
        with open(stray, "wb") as f:
            f.write(b"big")
        self._write_db([art, None])

        report = cover_cleanup.handle("t", {"beets_db": self.db, "library_dir": self.dir.name})

        self.assertEqual(report["removed"], 1)
        self.assertFalse(os.path.exists(os.path.join(os.path.dirname(art), "cover-hq.jpg")))
        self.assertTrue(os.path.exists(stray))

    def test_a_missing_database_is_a_quiet_zero(self):
        report = cover_cleanup.handle("t", {"beets_db": self.db, "library_dir": self.dir.name})
        self.assertEqual(report, {"removed": 0, "folders": 0})

    def test_two_albums_sharing_a_folder_sweep_it_once(self):
        art = self._album("Split Folder")
        with open(os.path.join(os.path.dirname(art), "cover-hq.png"), "wb") as f:
            f.write(b"big")
        self._write_db([art, art])

        report = cover_cleanup.handle("t", {"beets_db": self.db, "library_dir": self.dir.name})

        self.assertEqual(report, {"removed": 1, "folders": 1})


if __name__ == "__main__":
    unittest.main()
