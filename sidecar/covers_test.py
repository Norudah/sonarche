import os
import tempfile
import unittest

from PIL import Image

import covers


class HqNameTest(unittest.TestCase):
    def test_carries_the_extension_over(self):
        self.assertEqual(covers.hq_name_for("cover.jpg"), "cover-hq.jpg")
        self.assertEqual(covers.hq_name_for("cover.png"), "cover-hq.png")

    def test_normalises_case_so_one_name_is_ever_produced(self):
        self.assertEqual(covers.hq_name_for("cover.JPEG"), "cover-hq.jpeg")

    def test_falls_back_when_there_is_no_extension(self):
        # Better a wrong-but-consistent name than `cover-hq.` with a bare dot,
        # which is a hidden file on every system that matters.
        self.assertEqual(covers.hq_name_for("cover"), "cover-hq.jpg")


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
    silently does nothing, an archive that overwrites the file it archives —
    only exist on disk."""

    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def _make(self, name: str, width: int, height: int | None = None, mode="RGB") -> str:
        path = os.path.join(self.dir, name)
        Image.new(mode, (width, height if height is not None else width), "purple").save(path)
        return path

    def test_archives_the_original_and_shrinks_what_the_ui_reads(self):
        art = self._make("cover.jpg", 1400)

        self.assertTrue(covers.ensure_display_rendition(art))

        hq = os.path.join(self.dir, "cover-hq.jpg")
        self.assertTrue(os.path.exists(hq), "the original must survive")
        self.assertEqual(covers.read_dimensions(hq), (1400, 1400))
        width, height = covers.read_dimensions(art)
        self.assertEqual(max(width, height), covers.DISPLAY_MAX_PX)

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
        self.assertFalse(os.path.exists(os.path.join(self.dir, "cover-hq.jpg")))

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

    def test_never_archives_over_an_archive_that_is_already_there(self):
        """The regression that cost a real cover. An oversized file at artpath
        means something replaced our rendition since the last pass — beets'
        fetchart adopting `cover-hq.jpg` as an album's art on a re-import is one
        way — and copying it over the archive destroys the original we
        undertook to keep. The rendition is still made; the archive is not
        touched."""
        art = self._make("cover.jpg", 1400)
        hq = self._make("cover-hq.jpg", 3000)
        with open(hq, "rb") as f:
            original = f.read()

        self.assertTrue(covers.ensure_display_rendition(art))

        with open(hq, "rb") as f:
            self.assertEqual(f.read(), original, "the archive must survive")
        self.assertEqual(max(covers.read_dimensions(art)), covers.DISPLAY_MAX_PX)

    def test_finds_an_archive_whatever_its_extension(self):
        """`hq_name_for` derives the archive name from the *current* art, so a
        png arriving next to a jpg archive would miss it and the folder would
        end up holding two."""
        art = self._make("cover.png", 1400)
        self._make("cover-hq.jpg", 3000)

        self.assertTrue(covers.ensure_display_rendition(art))

        self.assertFalse(os.path.exists(os.path.join(self.dir, "cover-hq.png")))

    def test_leaves_no_working_copy_behind(self):
        art = self._make("cover.jpg", 1400)

        covers.ensure_display_rendition(art)

        leftovers = [n for n in os.listdir(self.dir) if n.endswith(".sonarche-original")]
        self.assertEqual(leftovers, [])


if __name__ == "__main__":
    unittest.main()
