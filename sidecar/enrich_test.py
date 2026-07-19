"""Regression tests for enrich's pure functions
(run: python -m unittest enrich_test)."""

import unittest

from enrich import work_fields


class WorkFieldsTest(unittest.TestCase):
    def test_drops_the_release_duration(self):
        # The regression this exists for: MusicBrainz' duration for the
        # recording replaced the downloaded file's own, and every duration in
        # the app inherited it.
        merged = {"title": "Vantablack", "artist": "Perturbator", "length": 304.4}
        self.assertEqual(work_fields(merged), {"title": "Vantablack", "artist": "Perturbator"})

    def test_keeps_everything_that_describes_the_work(self):
        merged = {
            "title": "God Complex",
            "artist": "Perturbator",
            "album": "New Model",
            "year": 2017,
            "index": 6,
            "mb_trackid": "abc",
        }
        self.assertEqual(work_fields(merged), merged)

    def test_survives_a_release_with_no_duration_at_all(self):
        self.assertEqual(work_fields({"title": "Halo"}), {"title": "Halo"})

    def test_returns_a_plain_dict_not_a_view_of_the_input(self):
        merged = {"title": "Java", "length": 197.0}
        result = work_fields(merged)
        result["title"] = "changed"
        self.assertEqual(merged["title"], "Java")


if __name__ == "__main__":
    unittest.main()
