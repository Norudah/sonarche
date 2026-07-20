import os
import tempfile
import unittest

from library import _art_path, art_paths_by_album


class FakeAlbum:
    def __init__(self, album_id, artpath):
        self.id = album_id
        self.artpath = artpath


class FakeLibrary:
    """Counts album reads: the point of the up-front pass is that this stays
    at one call no matter how many tracks the library holds."""

    def __init__(self, albums):
        self._albums = albums
        self.album_calls = 0

    def albums(self):
        self.album_calls += 1
        return list(self._albums)


class ArtPathTest(unittest.TestCase):
    def test_prefers_hq_cover_next_to_artpath(self):
        with tempfile.TemporaryDirectory() as art_dir:
            artpath = os.path.join(art_dir, "cover.jpg")
            hq = os.path.join(art_dir, "cover-hq.jpg")
            open(artpath, "wb").close()
            open(hq, "wb").close()

            self.assertEqual(_art_path(FakeAlbum(1, artpath.encode())), hq)

    def test_falls_back_to_artpath_without_hq(self):
        with tempfile.TemporaryDirectory() as art_dir:
            artpath = os.path.join(art_dir, "cover.jpg")
            open(artpath, "wb").close()

            self.assertEqual(_art_path(FakeAlbum(1, artpath.encode())), artpath)

    def test_no_artpath_yields_none(self):
        self.assertIsNone(_art_path(FakeAlbum(1, None)))
        self.assertIsNone(_art_path(None))


class ArtPathsByAlbumTest(unittest.TestCase):
    def test_resolves_each_album_once(self):
        lib = FakeLibrary([FakeAlbum(1, None), FakeAlbum(2, None)])

        self.assertEqual(art_paths_by_album(lib), {1: None, 2: None})
        self.assertEqual(lib.album_calls, 1)

    def test_unknown_album_id_misses_rather_than_raising(self):
        """A singleton has no album_id; the lookup must return None, not blow up."""
        mapping = art_paths_by_album(FakeLibrary([FakeAlbum(1, None)]))

        self.assertIsNone(mapping.get(None))
        self.assertIsNone(mapping.get(999))


if __name__ == "__main__":
    unittest.main()
