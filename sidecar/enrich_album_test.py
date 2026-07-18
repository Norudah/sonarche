"""Regression tests for enrich_album's pure functions
(run: python -m unittest enrich_album_test)."""

import unittest

from enrich_album import find_content_duplicates, match_by_recordings, vote_release


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


class FindContentDuplicatesTest(unittest.TestCase):
    def test_same_primary_marks_later_item(self):
        # Regression: a playlist carrying the same song under two different
        # video titles produced "02 Ready to Run.1.m4a" and a %aunique folder.
        # The same audio shares its primary (top-confidence) recording.
        dups = find_content_duplicates([(1, ["rec-a"]), (2, ["rec-b"]), (3, ["rec-a", "rec-c"])])
        self.assertEqual(dups, {3: 1})

    def test_shared_secondary_only_is_not_a_duplicate(self):
        # Regression (Hail to the King): two distinct album tracks whose only
        # overlap is a low-confidence *secondary* recording must NOT be deleted.
        # Item 2's primary is rec-b; it merely carries rec-a as a noisy second
        # candidate. Different primaries -> different audio -> both kept.
        dups = find_content_duplicates([(1, ["rec-a"]), (2, ["rec-b", "rec-a"])])
        self.assertEqual(dups, {})

    def test_disjoint_primaries_keep_everything(self):
        self.assertEqual(
            find_content_duplicates([(1, ["rec-a"]), (2, ["rec-b"])]), {}
        )

    def test_unidentified_items_never_match(self):
        # AcoustID silence (empty list) must not mark two unknowns as duplicates.
        self.assertEqual(find_content_duplicates([(1, []), (2, [])]), {})

    def test_chain_points_to_first_kept(self):
        dups = find_content_duplicates([(1, ["rec-a"]), (2, ["rec-a"]), (3, ["rec-a"])])
        self.assertEqual(dups, {2: 1, 3: 1})


class _Item:
    """Hashable stand-in for a beets Item: only `.id` and `.length` matter."""

    def __init__(self, item_id, length=None):
        self.id = item_id
        self.length = length


class _Track:
    def __init__(self, track_id, length=None):
        self.track_id = track_id
        self.length = length


class MatchByRecordingsTest(unittest.TestCase):
    def test_recording_identity_beats_junk_titles(self):
        # Regression: the playlist's video titles were shuffled (video "Clouds"
        # contained Steal My Girl…); the mapping must follow content, not tags.
        a, b = _Item(1, 228.0), _Item(2, 196.0)
        t_smg, t_rtr = _Track("rec-smg", 228.0), _Track("rec-rtr", 196.0)
        mapping, leftovers, extra = match_by_recordings(
            [a, b], [t_smg, t_rtr], {1: ["rec-smg"], 2: ["rec-rtr"]}
        )
        self.assertEqual(mapping, {a: t_smg, b: t_rtr})
        self.assertEqual(leftovers, [])
        self.assertEqual(extra, [])

    def test_identified_off_release_item_is_leftover_not_duration_mapped(self):
        # An item AcoustID identified as some other recording must not steal a
        # free slot just because a duration happens to fit.
        bonus = _Item(1, 200.0)
        slot = _Track("rec-other", 201.0)
        mapping, leftovers, extra = match_by_recordings([bonus], [slot], {1: ["rec-bonus"]})
        self.assertEqual(mapping, {})
        self.assertEqual(leftovers, [bonus])
        self.assertEqual(extra, [slot])

    def test_lone_leftover_takes_the_lone_free_slot(self):
        # Regression (Apocalyptic Love): the "You're a Lie [HD]" video rip ran
        # 259s against the album master's 231s and AcoustID resolved it to the
        # single's recording, so it matched neither by id nor by duration —
        # and landed untagged outside the album folder. With every other track
        # placed, the one empty slot is the only thing it can be.
        placed = [_Item(i, 200.0) for i in range(1, 4)]
        odd = _Item(4, 259.0)
        slots = [_Track(f"rec-{i}", 200.0) for i in range(1, 4)]
        gap = _Track("rec-album-lie", 231.0)
        mapping, leftovers, extra = match_by_recordings(
            [*placed, odd],
            [*slots, gap],
            {1: ["rec-1"], 2: ["rec-2"], 3: ["rec-3"], 4: ["rec-single-lie"]},
        )
        self.assertEqual(mapping[odd], gap)
        self.assertEqual(leftovers, [])
        self.assertEqual(extra, [])

    def test_lone_leftover_stays_put_without_a_mapped_majority(self):
        # Half the batch on the release is not enough to argue by elimination:
        # a two-file batch where one is off-release must leave it alone.
        mapped, odd = _Item(1, 200.0), _Item(2, 200.0)
        slot, gap = _Track("rec-1", 200.0), _Track("rec-2", 200.0)
        mapping, leftovers, extra = match_by_recordings(
            [mapped, odd], [slot, gap], {1: ["rec-1"], 2: ["rec-elsewhere"]}
        )
        self.assertEqual(mapping, {mapped: slot})
        self.assertEqual(leftovers, [odd])
        self.assertEqual(extra, [gap])

    def test_silent_item_rescued_by_nearest_duration(self):
        silent = _Item(1, 256.0)
        far, near = _Track("rec-a", 174.0), _Track("rec-b", 260.0)
        mapping, leftovers, _ = match_by_recordings([silent], [far, near], {1: []})
        self.assertEqual(mapping, {silent: near})
        self.assertEqual(leftovers, [])

    def test_silent_item_without_plausible_slot_is_leftover(self):
        silent = _Item(1, 100.0)
        mapping, leftovers, extra = match_by_recordings([silent], [_Track("rec-a", 300.0)], {1: []})
        self.assertEqual(mapping, {})
        self.assertEqual(leftovers, [silent])
        self.assertEqual(extra[0].track_id, "rec-a")

    def test_recording_pass_wins_slots_before_duration_pass(self):
        # The identified item owns its slot even when a silent item's duration
        # also fits it; the silent one takes what remains.
        identified, silent = _Item(1, 228.0), _Item(2, 229.0)
        slot_a, slot_b = _Track("rec-a", 228.0), _Track("rec-b", 231.0)
        mapping, leftovers, _ = match_by_recordings(
            [silent, identified], [slot_a, slot_b], {1: ["rec-a"], 2: []}
        )
        self.assertEqual(mapping[identified].track_id, "rec-a")
        self.assertEqual(mapping[silent].track_id, "rec-b")
        self.assertEqual(leftovers, [])


if __name__ == "__main__":
    unittest.main()
