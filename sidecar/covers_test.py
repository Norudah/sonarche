import os
import subprocess
import tempfile
import unittest

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


def _sips_available() -> bool:
    return os.path.exists(covers._SIPS)


@unittest.skipUnless(_sips_available(), "sips is macOS-only")
class RenditionTest(unittest.TestCase):
    """Against real images, because the interesting failures — a resize that
    silently does nothing, an archive that overwrites the file it archives —
    only exist on disk."""

    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def _make(self, name: str, size: int) -> str:
        path = os.path.join(self.dir, name)
        subprocess.run(
            ["/usr/bin/sips", "-s", "format", "jpeg", "-z", str(size), str(size),
             "/System/Library/CoreServices/DefaultDesktop.heic", "--out", path],
            capture_output=True, check=True,
        )
        return path

    def test_archives_the_original_and_shrinks_what_the_ui_reads(self):
        art = self._make("cover.jpg", 1400)

        self.assertTrue(covers.ensure_display_rendition(art))

        hq = os.path.join(self.dir, "cover-hq.jpg")
        self.assertTrue(os.path.exists(hq), "the original must survive")
        self.assertEqual(covers.read_dimensions(hq), (1400, 1400))
        width, height = covers.read_dimensions(art)
        self.assertEqual(max(width, height), covers.DISPLAY_MAX_PX)

    def test_leaves_an_already_small_cover_untouched(self):
        art = self._make("cover.jpg", 400)
        before = os.path.getsize(art)

        self.assertFalse(covers.ensure_display_rendition(art))

        self.assertEqual(os.path.getsize(art), before)
        self.assertFalse(os.path.exists(os.path.join(self.dir, "cover-hq.jpg")))

    def test_a_missing_cover_is_not_an_error(self):
        self.assertFalse(covers.ensure_display_rendition(os.path.join(self.dir, "nope.jpg")))
        self.assertFalse(covers.ensure_display_rendition(""))


if __name__ == "__main__":
    unittest.main()
