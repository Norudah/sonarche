import unittest

import accepted


class ParseTest(unittest.TestCase):
    def test_reads_the_stored_list(self):
        self.assertEqual(accepted.parse("year,genre"), {"year", "genre"})
        self.assertEqual(accepted.parse(" year , genre "), {"year", "genre"})

    def test_anything_unreadable_accepts_nothing(self):
        """A corrupt value must never make an object look accepted — that would
        silence a check without anyone having answered it."""
        self.assertEqual(accepted.parse(None), set())
        self.assertEqual(accepted.parse(""), set())
        self.assertEqual(accepted.parse(0), set())
        self.assertEqual(accepted.parse(["year"]), set())


class VocabularyTest(unittest.TestCase):
    def test_the_two_scopes_answer_different_checks(self):
        """The front, the Rust command and this module all spell the vocabulary
        out; a word missing from one of the three is a silent refusal at the
        far end of the chain."""
        self.assertEqual(accepted.TRACK_CHECKS, ("year", "track", "genre", "duplicates"))
        self.assertEqual(accepted.ALBUM_CHECKS, ("artwork",))

    def test_a_track_check_is_never_an_album_one(self):
        for check in accepted.TRACK_CHECKS:
            self.assertNotIn(check, accepted.ALBUM_CHECKS)


class NextValueTest(unittest.TestCase):
    def test_adds_and_removes_one_check_leaving_the_others(self):
        self.assertEqual(accepted.next_value("year", "genre", True), "genre,year")
        self.assertEqual(accepted.next_value("genre,year", "genre", False), "year")

    def test_the_empty_set_is_stored_as_nothing_at_all(self):
        """Absent is the default; a row saying "accepts nothing" would outlive
        its meaning."""
        self.assertIsNone(accepted.next_value("year", "year", False))
        self.assertIsNone(accepted.next_value(None, "year", False))

    def test_is_stable_so_an_unchanged_write_is_detectable(self):
        self.assertEqual(
            accepted.next_value("genre,year", "year", True),
            accepted.next_value("year,genre", "year", True),
        )


if __name__ == "__main__":
    unittest.main()
