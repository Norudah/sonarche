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


class CandidateSortKeyTest(unittest.TestCase):
    """The Real Gone regression: one fingerprint, two linked recordings, and
    the wrong one first by AcoustID submission count. The video title is the
    signal that survives, so it must outrank the release type."""

    STUDIO = {"status": "Official", "release_group": {"primary_type": "Album"}, "date": "2005"}
    SOUNDTRACK = {
        "status": "Official",
        "release_group": {"primary_type": "Album", "secondary_types": ["Soundtrack"]},
        "date": "2006",
    }

    def test_the_title_the_video_names_beats_a_better_ranked_release(self):
        from enrich import candidate_sort_key

        hint = "Sheryl Crow - Real Gone (Cars Soundtrack)"
        # The mislinked recording resolves to a clean studio album; the right
        # one only lives on the soundtrack. The old order picked the wrong song.
        wrong = candidate_sort_key(hint, "Sleepin' on the Foldout", self.STUDIO)
        right = candidate_sort_key(hint, "Real Gone", self.SOUNDTRACK)
        self.assertLess(right, wrong)

    def test_release_rank_still_arbitrates_between_agreeing_titles(self):
        from enrich import candidate_sort_key

        hint = "Real Gone"
        album = candidate_sort_key(hint, "Real Gone", self.STUDIO)
        compilation = candidate_sort_key(hint, "Real Gone", self.SOUNDTRACK)
        self.assertLess(album, compilation)

    def test_a_junk_hint_changes_nothing(self):
        from enrich import candidate_sort_key

        # Both sides reduce to noise: every candidate is neutral, the release
        # rank decides — the pre-hint behavior, exactly.
        album = candidate_sort_key("(Official Video) [HD]", "Live Edit", self.STUDIO)
        soundtrack = candidate_sort_key("(Official Video) [HD]", "Remix", self.SOUNDTRACK)
        self.assertEqual(album[0], soundtrack[0])
        self.assertLess(album, soundtrack)

    def test_settles_early_only_when_the_video_vouches_for_it(self):
        from enrich import candidate_sort_key, is_settled

        hint = "Real Gone"
        vouched = candidate_sort_key(hint, "Real Gone", self.STUDIO)
        contradicted = candidate_sort_key(hint, "Sleepin' on the Foldout", self.STUDIO)
        self.assertTrue(is_settled(vouched, hint))
        # A perfect release whose title the video denies must not end the scan:
        # the right song may still be a later candidate.
        self.assertFalse(is_settled(contradicted, hint))

    def test_settles_on_rank_alone_when_the_hint_is_junk(self):
        from enrich import candidate_sort_key, is_settled

        hint = "(Official Video) [HD]"
        key = candidate_sort_key(hint, "Some Song", self.STUDIO)
        self.assertTrue(is_settled(key, hint))
