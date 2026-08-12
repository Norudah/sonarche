import io
import os
import tempfile
import unittest

from PIL import Image

import cover_set


class SquareCropBoxTest(unittest.TestCase):
    def test_no_crop_takes_the_centered_square(self):
        self.assertEqual(cover_set.square_crop_box(1000, 600, None), (200, 0, 600))
        self.assertEqual(cover_set.square_crop_box(600, 1000, None), (0, 200, 600))

    def test_a_square_source_is_kept_whole(self):
        self.assertEqual(cover_set.square_crop_box(800, 800, None), (0, 0, 800))

    def test_a_requested_crop_is_honoured(self):
        crop = {"left": 100, "top": 0, "size": 600}
        self.assertEqual(cover_set.square_crop_box(1000, 600, crop), (100, 0, 600))

    def test_a_drifted_crop_is_clamped_not_rejected(self):
        # One pixel of rounding drift from the preview's scale must not fail
        # the replacement.
        crop = {"left": 401, "top": 0, "size": 600}
        self.assertEqual(cover_set.square_crop_box(1000, 600, crop), (400, 0, 600))
        oversized = {"left": 0, "top": 0, "size": 4000}
        self.assertEqual(cover_set.square_crop_box(1000, 600, oversized), (0, 0, 600))


class PrepareCoverTest(unittest.TestCase):
    def _write(self, width, height, fmt, suffix):
        image = Image.new("RGB", (width, height), (200, 40, 40))
        handle = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        self.addCleanup(os.remove, handle.name)
        image.save(handle.name, format=fmt)
        return handle.name

    def test_a_square_jpeg_is_archived_byte_for_byte(self):
        path = self._write(800, 800, "JPEG", ".jpg")
        hq, thumb, is_png, side = cover_set.prepare_cover(path, None)
        with open(path, "rb") as f:
            self.assertEqual(hq, f.read())
        self.assertFalse(is_png)
        self.assertEqual(side, 800)

    def test_a_cropped_source_is_reencoded_square(self):
        path = self._write(1000, 600, "JPEG", ".jpg")
        hq, thumb, is_png, side = cover_set.prepare_cover(path, {"left": 0, "top": 0, "size": 600})
        self.assertEqual(side, 600)
        with Image.open(io.BytesIO(hq)) as archived:
            self.assertEqual(archived.size, (600, 600))
            self.assertEqual(archived.format, "JPEG")

    def test_the_thumb_fits_the_display_ceiling(self):
        path = self._write(1600, 1600, "JPEG", ".jpg")
        _, thumb, _, _ = cover_set.prepare_cover(path, None)
        with Image.open(io.BytesIO(thumb)) as rendition:
            self.assertEqual(rendition.size, (500, 500))

    def test_a_small_source_is_never_upscaled(self):
        path = self._write(300, 300, "JPEG", ".jpg")
        _, thumb, _, side = cover_set.prepare_cover(path, None)
        self.assertEqual(side, 300)
        with Image.open(io.BytesIO(thumb)) as rendition:
            self.assertEqual(rendition.size, (300, 300))

    def test_png_stays_png(self):
        path = self._write(700, 700, "PNG", ".png")
        hq, thumb, is_png, _ = cover_set.prepare_cover(path, None)
        self.assertTrue(is_png)
        with Image.open(io.BytesIO(thumb)) as rendition:
            self.assertEqual(rendition.format, "PNG")

    def test_a_webp_source_is_archived_as_jpeg(self):
        # The archive must stay in a format every later reader (and the m4a
        # `covr` atom) understands.
        path = self._write(900, 900, "WEBP", ".webp")
        hq, _, is_png, _ = cover_set.prepare_cover(path, None)
        self.assertFalse(is_png)
        with Image.open(io.BytesIO(hq)) as archived:
            self.assertEqual(archived.format, "JPEG")

    def test_an_absurd_source_is_refused(self):
        path = self._write(50, 50, "JPEG", ".jpg")
        original = cover_set.MAX_SOURCE_PX
        cover_set.MAX_SOURCE_PX = 40
        self.addCleanup(setattr, cover_set, "MAX_SOURCE_PX", original)
        with self.assertRaises(RuntimeError):
            cover_set.prepare_cover(path, None)


class HandleParamsTest(unittest.TestCase):
    def test_exactly_one_source_is_required(self):
        with self.assertRaises(RuntimeError):
            cover_set.handle("r1", {})
        with self.assertRaises(RuntimeError):
            cover_set.handle("r1", {"source_path": "/a.jpg", "image_url": "https://coverartarchive.org/x"})


class DownloadCandidateTest(unittest.TestCase):
    def test_refuses_a_url_outside_the_archive(self):
        with self.assertRaises(RuntimeError):
            cover_set._download_candidate("https://evil.example/cover.jpg")


class ShapeCandidatesTest(unittest.TestCase):
    def _image(self, image_id, front=False, image="https://coverartarchive.org/full.jpg", thumbs=None):
        return {
            "id": image_id,
            "front": front,
            "image": image,
            "thumbnails": {"250": f"https://coverartarchive.org/{image_id}-250.jpg"} if thumbs is None else thumbs,
            "types": ["Front"] if front else ["Back"],
        }

    def test_fronts_come_first_and_the_list_is_capped(self):
        images = [self._image(i) for i in range(cover_set.MAX_CANDIDATES + 3)] + [self._image("front", front=True)]
        out = cover_set.shape_candidates(images, lambda url: "data:image/jpeg;base64,x")
        self.assertEqual(len(out), cover_set.MAX_CANDIDATES)
        self.assertEqual(out[0]["id"], "front")
        self.assertTrue(out[0]["front"])

    def test_drops_entries_the_strip_could_not_draw(self):
        images = [
            self._image("ok"),
            self._image("no-urls", image=None, thumbs={}),
            self._image("dead-thumb"),
        ]
        out = cover_set.shape_candidates(images, lambda url: None if "dead-thumb" in url else "data:image/jpeg;base64,x")
        self.assertEqual([c["id"] for c in out], ["ok"])

    def test_http_urls_from_the_index_are_upgraded_to_https(self):
        # The live CAA index returns http:// URLs; left as-is they fail the
        # https-pinned validation on both sides of the IPC and the replacement
        # dies before any work.
        fetched = []

        def fetch(url):
            fetched.append(url)
            return "data:image/jpeg;base64,x"

        images = [
            self._image(
                "plain",
                image="http://coverartarchive.org/release/x/1.png",
                thumbs={"250": "http://coverartarchive.org/release/x/1-250.jpg"},
            )
        ]
        out = cover_set.shape_candidates(images, fetch)
        self.assertEqual(out[0]["image_url"], "https://coverartarchive.org/release/x/1.png")
        self.assertEqual(fetched, ["https://coverartarchive.org/release/x/1-250.jpg"])

    def test_falls_back_to_the_full_image_when_no_small_thumbnail(self):
        seen = []

        def fetch(url):
            seen.append(url)
            return "data:image/jpeg;base64,x"

        cover_set.shape_candidates([self._image("bare", thumbs={})], fetch)
        self.assertEqual(seen, ["https://coverartarchive.org/full.jpg"])


if __name__ == "__main__":
    unittest.main()
