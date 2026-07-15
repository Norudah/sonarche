"""Regression tests for bucket_for (run: python -m unittest genre_buckets_test)."""

import unittest
from collections import Counter

import genre_buckets
from genre_buckets import _BUCKETS, bucket_for


class BucketForTest(unittest.TestCase):
    def test_guitar_industrial_is_metal_not_electronic(self):
        # Regression: industrial metal / NDH inherited "electronic" from the seed tree.
        self.assertEqual(bucket_for("Industrial Metal"), "Metal")
        self.assertEqual(bucket_for("Neue Deutsche Härte"), "Metal")
        self.assertEqual(bucket_for("industrial rock"), "Rock")

    def test_genuine_electronic_industrial_stays_electronic(self):
        for g in ("electronic body music", "death industrial", "power noise",
                  "electro-industrial", "power electronics"):
            self.assertEqual(bucket_for(g), "Electronic", g)

    def test_case_insensitive_and_trimmed(self):
        self.assertEqual(bucket_for("  METAL  "), bucket_for("metal"))

    def test_unmapped_and_empty(self):
        self.assertIsNone(bucket_for("nonexistent genre"))
        self.assertIsNone(bucket_for(None))
        self.assertIsNone(bucket_for(""))

    def test_no_genre_in_two_buckets(self):
        counts = Counter(g for genres in _BUCKETS.values() for g in genres)
        self.assertEqual([g for g, n in counts.items() if n > 1], [])

    def test_bucket_entries_are_lowercase(self):
        for genres in _BUCKETS.values():
            for g in genres:
                self.assertEqual(g, g.lower(), g)


if __name__ == "__main__":
    unittest.main()
