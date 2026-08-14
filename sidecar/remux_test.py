"""Regression tests for remux box detection (run: python -m unittest remux_test)."""

import os
import sqlite3
import struct
import tempfile
import unittest

from remux import _checked_through, _library_paths, is_fragmented, top_level_boxes


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


class LibraryPathsTest(unittest.TestCase):
    """The launch repair pass runs before anything guarantees a library
    exists — right after a data erase, and on a first run. No database means
    no files to repair, not a failure."""

    def test_a_missing_database_yields_no_targets(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing = os.path.join(tmp, "library.db")
            self.assertEqual(_library_paths(missing, tmp, 0), ([], 0))

    def test_only_items_past_the_watermark_are_scanned(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = os.path.join(tmp, "library.db")
            conn = sqlite3.connect(db)
            conn.execute("CREATE TABLE items (id INTEGER PRIMARY KEY, path BLOB)")
            for item_id, name in [(1, "old.m4a"), (2, "new.m4a"), (3, "cover.jpg")]:
                path = os.path.join(tmp, name)
                with open(path, "wb") as handle:
                    handle.write(b"x")
                conn.execute("INSERT INTO items VALUES (?, ?)", (item_id, path.encode()))
            conn.commit()
            conn.close()

            targets, newest = _library_paths(db, tmp, 1)
            self.assertEqual([item_id for item_id, _ in targets], [2])
            # The jpg has nothing to remux but still advances the cursor.
            self.assertEqual(newest, 3)


class CheckedThroughTest(unittest.TestCase):
    """The watermark rule: settle everything below the first failure, so a
    clean pass never re-runs and a failed file is retried next launch."""

    def test_a_clean_pass_settles_everything(self):
        self.assertEqual(_checked_through(10, 42, []), 42)

    def test_a_failure_holds_the_watermark_just_before_it(self):
        self.assertEqual(_checked_through(10, 42, [30, 35]), 29)

    def test_a_failure_on_the_first_new_item_never_regresses(self):
        self.assertEqual(_checked_through(10, 42, [11]), 10)

    def test_an_empty_slice_stays_put(self):
        self.assertEqual(_checked_through(7, 7, []), 7)


if __name__ == "__main__":
    unittest.main()
