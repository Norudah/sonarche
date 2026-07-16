"""Regression tests for pick_release (run: python -m unittest metadata_test)."""

import unittest

from metadata import pick_release, release_rank


def _rel(title, date, primary, secondary=None, status="Official"):
    return {
        "title": title,
        "date": date,
        "status": status,
        "release_group": {"primary_type": primary, "secondary_types": secondary or []},
    }


class PickReleaseTest(unittest.TestCase):
    def test_album_beats_earlier_single(self):
        # Regression: "Sonne" resolved to the earlier-dated single, not Mutter.
        releases = [
            _rel("Sonne", "2001-02-01", "Single"),
            _rel("Mutter", "2001-03-27", "Album"),
        ]
        self.assertEqual(pick_release(releases)["title"], "Mutter")

    def test_album_beats_compilation(self):
        # Regression: a best-of ("Made in Germany 1995–2011") outranked the album.
        releases = [
            _rel("Made in Germany 1995–2011", "2011-12-02", "Album", ["Compilation"]),
            _rel("Mutter", "2001-03-27", "Album"),
        ]
        self.assertEqual(pick_release(releases)["title"], "Mutter")

    def test_earliest_album_wins_as_tiebreak(self):
        releases = [
            _rel("Mutter (reissue)", "2001-10-29", "Album"),
            _rel("Mutter", "2001-03-27", "Album"),
        ]
        self.assertEqual(pick_release(releases)["date"], "2001-03-27")

    def test_single_beats_compilation_when_no_album(self):
        releases = [
            _rel("Best Of", "2011", "Album", ["Compilation"]),
            _rel("Sonne", "2001-02-01", "Single"),
        ]
        self.assertEqual(pick_release(releases)["title"], "Sonne")

    def test_official_preferred_over_bootleg(self):
        releases = [
            _rel("Golden Collection", "2010", "Album", status="Bootleg"),
            _rel("Mutter", "2001-03-27", "Album", status="Official"),
        ]
        self.assertEqual(pick_release(releases)["title"], "Mutter")

    def test_missing_release_group_degrades_to_earliest_date(self):
        # Old lookups without `release-groups`: all types equal, earliest wins.
        releases = [
            {"title": "B", "date": "2005", "status": "Official"},
            {"title": "A", "date": "2001", "status": "Official"},
        ]
        self.assertEqual(pick_release(releases)["title"], "A")

    def test_empty(self):
        self.assertIsNone(pick_release([]))


class ReleaseRankTest(unittest.TestCase):
    """release_rank compares picks across the several recordings one fingerprint
    resolves to; the compilation-linked recording must lose to the album one."""

    def test_studio_album_beats_compilation_across_recordings(self):
        album = _rel("Mutter", "2001-03-27", "Album")
        comp = _rel("Made in Germany 1995–2011", "2011", "Album", ["Compilation"])
        self.assertLess(release_rank(album), release_rank(comp))

    def test_clean_album_is_flagged_as_ideal(self):
        rank = release_rank(_rel("Mutter", "2001-03-27", "Album"))
        self.assertFalse(rank[0])  # no unwanted secondary type
        self.assertEqual(rank[1], 0)  # Album primary type

    def test_single_ranks_between_album_and_compilation(self):
        album = release_rank(_rel("A", "2001", "Album"))
        single = release_rank(_rel("B", "2001", "Single"))
        comp = release_rank(_rel("C", "2001", "Album", ["Compilation"]))
        self.assertLess(album, single)
        self.assertLess(single, comp)


if __name__ == "__main__":
    unittest.main()
