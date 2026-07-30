"""Unit tests for the pure parts of the align pass
(run: python -m unittest library_align_test)."""

import unittest

from library_align import ALBUM_FILL_FIELDS, FILL_FIELDS, acceptable, blank, plan_fills


class BlankTest(unittest.TestCase):
    def test_absences_beets_actually_stores(self):
        # beets keeps 0 for a missing year/track and "" for a missing id.
        for value in (None, "", 0):
            self.assertTrue(blank(value), repr(value))

    def test_real_values_are_not_blank(self):
        for value in ("1997", 1997, "b1a9c0e9", 1):
            self.assertFalse(blank(value), repr(value))


class AcceptableTest(unittest.TestCase):
    def test_near_perfect_full_mapping_passes(self):
        self.assertTrue(acceptable(0.05, 0))

    def test_a_single_unmapped_file_rejects_the_release(self):
        self.assertFalse(acceptable(0.05, 1))

    def test_distance_above_the_bar_rejects(self):
        self.assertFalse(acceptable(0.30, 0))


class PlanFillsTest(unittest.TestCase):
    def test_only_blank_fields_are_filled(self):
        fills = plan_fills(
            {"year": 0, "title": "Kept Title", "mb_trackid": ""},
            {"year": 1997, "title": "Canonical Title", "mb_trackid": "rid"},
            set(),
        )
        self.assertEqual(fills, {"year": 1997, "mb_trackid": "rid"})

    def test_hand_edited_fields_are_spared_even_when_blank(self):
        fills = plan_fills({"year": 0}, {"year": 1997}, {"year"})
        self.assertEqual(fills, {})

    def test_blank_candidates_never_fill(self):
        # A release without a year must not "fill" year with 0.
        fills = plan_fills({"year": 0}, {"year": 0}, set())
        self.assertEqual(fills, {})

    def test_fields_outside_the_whitelist_are_dropped(self):
        # The plan crosses the IPC boundary: a forged entry must not reach
        # `path` or any other unlisted field.
        fills = plan_fills({}, {"path": "/etc/passwd", "year": 1997}, set())
        self.assertEqual(fills, {"year": 1997})

    def test_album_field_list_is_a_subset_of_reason(self):
        # The album row list must never grow a field items don't have.
        self.assertTrue(set(ALBUM_FILL_FIELDS) <= set(FILL_FIELDS))
