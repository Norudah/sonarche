import os
import tempfile
import unittest

from PIL import Image

from artist_image import handle


class HandleTest(unittest.TestCase):
    def _source(self, width, height, fmt="JPEG", suffix=".jpg"):
        handle_, path = tempfile.mkstemp(suffix=suffix)
        os.close(handle_)
        self.addCleanup(lambda: os.path.exists(path) and os.remove(path))
        Image.new("RGB", (width, height), "orange").save(path, format=fmt)
        return path

    def _dest(self):
        dest = tempfile.mkdtemp()
        self.addCleanup(lambda: __import__("shutil").rmtree(dest, ignore_errors=True))
        return dest

    def test_writes_a_display_rendition_at_most_500px(self):
        dest = self._dest()
        result = handle("req", {"source_path": self._source(1200, 800), "dest_dir": dest, "stem": "abc"})

        self.assertEqual(result["filename"], "abc.jpg")
        self.assertEqual(result["side"], 800)
        with Image.open(os.path.join(dest, "abc.jpg")) as written:
            self.assertEqual(written.size, (500, 500))

    def test_the_crop_is_honoured(self):
        dest = self._dest()
        result = handle(
            "req",
            {
                "source_path": self._source(1200, 400),
                "dest_dir": dest,
                "stem": "abc",
                "crop": {"left": 100, "top": 0, "size": 400},
            },
        )
        self.assertEqual(result["side"], 400)

    def test_png_stays_png(self):
        dest = self._dest()
        result = handle(
            "req", {"source_path": self._source(600, 600, fmt="PNG", suffix=".png"), "dest_dir": dest, "stem": "abc"}
        )
        self.assertEqual(result["filename"], "abc.png")
        with Image.open(os.path.join(dest, "abc.png")) as written:
            self.assertEqual(written.format, "PNG")

    def test_a_small_source_is_never_upscaled(self):
        dest = self._dest()
        handle("req", {"source_path": self._source(300, 300), "dest_dir": dest, "stem": "abc"})
        with Image.open(os.path.join(dest, "abc.jpg")) as written:
            self.assertEqual(written.size, (300, 300))

    def test_a_missing_source_is_refused(self):
        with self.assertRaises(RuntimeError):
            handle("req", {"source_path": "/nowhere/img.jpg", "dest_dir": self._dest(), "stem": "abc"})


if __name__ == "__main__":
    unittest.main()
