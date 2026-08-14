import os
import tempfile
import unittest

from PIL import Image

import covers


class NeedsRenditionTest(unittest.TestCase):
    def test_judges_on_the_longest_side(self):
        self.assertTrue(covers.needs_rendition(1400, 200))
        self.assertTrue(covers.needs_rendition(200, 1400))

    def test_a_cover_already_at_the_ceiling_is_the_rendition(self):
        self.assertFalse(covers.needs_rendition(500, 500))
        self.assertFalse(covers.needs_rendition(500, 320))

    def test_leaves_small_covers_alone(self):
        self.assertFalse(covers.needs_rendition(200, 200))


class RenditionTest(unittest.TestCase):
    """Against real images, because the interesting failures — a resize that
    silently does nothing, a half-written file — only exist on disk."""

    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def _make(self, name: str, width: int, height: int | None = None, mode="RGB") -> str:
        path = os.path.join(self.dir, name)
        Image.new(mode, (width, height if height is not None else width), "purple").save(path)
        return path

    def test_shrinks_what_the_ui_reads_in_place(self):
        art = self._make("cover.jpg", 1400)

        self.assertTrue(covers.ensure_display_rendition(art))

        width, height = covers.read_dimensions(art)
        self.assertEqual(max(width, height), covers.DISPLAY_MAX_PX)
        # No archive convention any more: the folder holds the rendition alone.
        self.assertEqual(sorted(os.listdir(self.dir)), ["cover.jpg"])

    def test_keeps_the_aspect_ratio(self):
        """A squashed cover is worse than a big one: the ceiling is on the
        longest side, not on both."""
        art = self._make("cover.jpg", 1400, 700)

        self.assertTrue(covers.ensure_display_rendition(art))

        self.assertEqual(covers.read_dimensions(art), (500, 250))

    def test_a_png_stays_a_png(self):
        """The rendition is written over beets' own artpath, so re-encoding a
        `.png` as JPEG would leave every later reader guessing wrong. Alpha is
        the tell: it does not survive a silent conversion."""
        art = self._make("cover.png", 1400, mode="RGBA")

        self.assertTrue(covers.ensure_display_rendition(art))

        with Image.open(art) as image:
            self.assertEqual(image.format, "PNG")
            self.assertEqual(image.mode, "RGBA")

    def test_leaves_an_already_small_cover_untouched(self):
        art = self._make("cover.jpg", 400)
        before = os.path.getsize(art)

        self.assertFalse(covers.ensure_display_rendition(art))

        self.assertEqual(os.path.getsize(art), before)

    def test_a_missing_cover_is_not_an_error(self):
        self.assertFalse(covers.ensure_display_rendition(os.path.join(self.dir, "nope.jpg")))
        self.assertFalse(covers.ensure_display_rendition(""))

    def test_an_unreadable_file_is_not_an_error(self):
        """A stray non-image under an image name is a bad cover, not a crash in
        the middle of an import sweep."""
        broken = os.path.join(self.dir, "cover.jpg")
        with open(broken, "w") as f:
            f.write("not an image")

        self.assertIsNone(covers.read_dimensions(broken))
        self.assertFalse(covers.ensure_display_rendition(broken))

    def test_a_legacy_archive_is_not_touched_by_the_rendition(self):
        """The rendition pass has one job. Legacy `cover-hq.*` files are the
        cleanup pass's business, and quietly eating one here would make the
        rendition sweep destructive in a folder it only came to shrink."""
        art = self._make("cover.jpg", 1400)
        hq = self._make("cover-hq.jpg", 3000)
        with open(hq, "rb") as f:
            original = f.read()

        self.assertTrue(covers.ensure_display_rendition(art))

        with open(hq, "rb") as f:
            self.assertEqual(f.read(), original)
        self.assertEqual(max(covers.read_dimensions(art)), covers.DISPLAY_MAX_PX)

    def test_leaves_no_working_copy_behind(self):
        art = self._make("cover.jpg", 1400)

        covers.ensure_display_rendition(art)

        leftovers = [n for n in os.listdir(self.dir) if n.endswith(".sonarche-original")]
        self.assertEqual(leftovers, [])


class RemoveLegacyArchivesTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def _touch(self, name: str) -> str:
        path = os.path.join(self.dir, name)
        with open(path, "wb") as f:
            f.write(b"x")
        return path

    def test_removes_every_archive_and_nothing_else(self):
        self._touch("cover-hq.jpg")
        self._touch("cover-hq.png")
        kept = self._touch("cover.jpg")
        audio = self._touch("01 Track.m4a")

        self.assertEqual(covers.remove_legacy_archives(self.dir), 2)

        self.assertEqual(sorted(os.listdir(self.dir)), sorted([os.path.basename(kept), os.path.basename(audio)]))

    def test_a_folder_without_archives_is_a_quiet_zero(self):
        self._touch("cover.jpg")
        self.assertEqual(covers.remove_legacy_archives(self.dir), 0)

    def test_a_missing_folder_is_a_quiet_zero(self):
        self.assertEqual(covers.remove_legacy_archives(os.path.join(self.dir, "gone")), 0)


if __name__ == "__main__":
    unittest.main()
