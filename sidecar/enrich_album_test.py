"""Regression tests for vote_release (run: python -m unittest enrich_album_test)."""

import unittest

from enrich_album import vote_release


def _rel(release_id, primary="Album", secondary=None, date="2001", track_count=None, status="Official"):
    rel = {
        "id": release_id,
        "date": date,
        "status": status,
        "release_group": {"primary_type": primary, "secondary_types": secondary or []},
    }
    if track_count is not None:
        rel["track-count"] = track_count
    return rel


class VoteReleaseTest(unittest.TestCase):
    def test_majority_release_wins(self):
        sets = [
            [_rel("album"), _rel("comp", secondary=["Compilation"])],
            [_rel("album")],
            [_rel("other")],
        ]
        self.assertEqual(vote_release(sets, 11), "album")

    def test_majority_beats_better_rank(self):
        # A compilation shared by all samples beats an album seen once: the
        # shared release is the one the files actually came from.
        sets = [
            [_rel("comp", secondary=["Compilation"]), _rel("album")],
            [_rel("comp", secondary=["Compilation"])],
            [_rel("comp", secondary=["Compilation"])],
        ]
        self.assertEqual(vote_release(sets, 11), "comp")

    def test_track_count_breaks_vote_tie(self):
        sets = [
            [_rel("deluxe", track_count=16), _rel("standard", track_count=11)],
            [_rel("deluxe", track_count=16), _rel("standard", track_count=11)],
        ]
        self.assertEqual(vote_release(sets, 11), "standard")

    def test_studio_album_beats_compilation_on_tie(self):
        sets = [
            [_rel("comp", secondary=["Compilation"]), _rel("album")],
            [_rel("comp", secondary=["Compilation"]), _rel("album")],
        ]
        self.assertEqual(vote_release(sets, 11), "album")

    def test_single_sample_still_votes(self):
        sets = [[_rel("album"), _rel("comp", secondary=["Compilation"])]]
        self.assertEqual(vote_release(sets, 11), "album")

    def test_duplicate_in_one_set_counts_once(self):
        # The same release appearing twice within one sample (two recordings)
        # must not fake a second vote.
        sets = [
            [_rel("comp", secondary=["Compilation"]), _rel("comp", secondary=["Compilation"])],
            [_rel("album")],
            [_rel("album")],
        ]
        self.assertEqual(vote_release(sets, 11), "album")

    def test_missing_track_count_tolerated(self):
        sets = [[_rel("album")], [_rel("album")]]
        self.assertEqual(vote_release(sets, 11), "album")

    def test_empty_sets(self):
        self.assertIsNone(vote_release([], 11))
        self.assertIsNone(vote_release([[], []], 11))

    def test_release_without_id_ignored(self):
        sets = [[{"date": "2001"}, _rel("album")]]
        self.assertEqual(vote_release(sets, 11), "album")


if __name__ == "__main__":
    unittest.main()
