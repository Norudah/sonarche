"""Regression tests for remux box detection (run: python -m unittest remux_test)."""

import os
import struct
import tempfile
import unittest

from remux import is_fragmented, top_level_boxes


def _box(name: bytes, payload: bytes = b"") -> bytes:
    return struct.pack(">I4s", 8 + len(payload), name) + payload


def _wide_box(name: bytes, payload: bytes = b"") -> bytes:
    return struct.pack(">I4s", 1, name) + struct.pack(">Q", 16 + len(payload)) + payload


class BoxScanTest(unittest.TestCase):
    def _write(self, data: bytes) -> str:
        handle = tempfile.NamedTemporaryFile(suffix=".m4a", delete=False)
        self.addCleanup(os.remove, handle.name)
        handle.write(data)
        handle.close()
        return handle.name

    def test_classic_file_is_not_fragmented(self):
        path = self._write(_box(b"ftyp", b"M4A \x00\x00\x00\x00") + _box(b"moov", b"x" * 40) + _box(b"mdat", b"y" * 100))
        self.assertEqual(top_level_boxes(path), [b"ftyp", b"moov", b"mdat"])
        self.assertFalse(is_fragmented(path))

    def test_dash_file_is_fragmented(self):
        path = self._write(
            _box(b"ftyp") + _box(b"moov", b"x" * 40) + _box(b"sidx", b"s" * 24) + _box(b"moof", b"f" * 32) + _box(b"mdat")
        )
        self.assertTrue(is_fragmented(path))

    def test_moof_alone_is_enough(self):
        path = self._write(_box(b"ftyp") + _box(b"moof"))
        self.assertTrue(is_fragmented(path))

    def test_64_bit_box_size_is_followed(self):
        path = self._write(_box(b"ftyp") + _wide_box(b"mdat", b"y" * 32) + _box(b"moof"))
        self.assertTrue(is_fragmented(path))

    def test_zero_size_means_to_end_of_file(self):
        # A last box with size 0 runs to EOF; the scan must record it and stop.
        data = _box(b"ftyp") + struct.pack(">I4s", 0, b"mdat") + b"y" * 50
        path = self._write(data)
        self.assertEqual(top_level_boxes(path), [b"ftyp", b"mdat"])

    def test_truncated_header_ends_the_scan(self):
        path = self._write(_box(b"ftyp") + b"\x00\x00")
        self.assertEqual(top_level_boxes(path), [b"ftyp"])
        self.assertFalse(is_fragmented(path))

    def test_corrupt_size_ends_the_scan(self):
        # size=4 is smaller than its own header: stop, do not loop.
        path = self._write(_box(b"ftyp") + struct.pack(">I4s", 4, b"junk") + _box(b"moof"))
        self.assertEqual(top_level_boxes(path), [b"ftyp"])

    def test_empty_file(self):
        path = self._write(b"")
        self.assertEqual(top_level_boxes(path), [])
        self.assertFalse(is_fragmented(path))


if __name__ == "__main__":
    unittest.main()
