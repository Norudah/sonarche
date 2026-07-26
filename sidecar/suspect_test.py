"""Regression tests for the suspect-match flag
(run: python -m unittest suspect_test)."""

import unittest

from suspect import SUSPECT_MATCH, TITLE_MISMATCH, is_title_mismatch, mark, titles_agree


class IsTitleMismatchTest(unittest.TestCase):
    def test_cross_language_match_is_flagged(self):
        # Regression (Spirit): French audio fingerprint-matched to the English
        # recording — the video title is the only surviving signal.
        self.assertTrue(is_title_mismatch("Sonne le clairon", "Sound the Bugle"))
        self.assertTrue(is_title_mismatch("Je défendrai ma vie", "You Can’t Take Me"))
        self.assertTrue(is_title_mismatch("Rien de ce que j'ai vécu", "Nothing I’ve Ever Known"))

    def test_same_song_with_junk_suffix_is_not_flagged(self):
        self.assertFalse(is_title_mismatch("Me voilà (End Title)", "Me voilà (version single)"))
        self.assertFalse(is_title_mismatch("Run Free (Official Video) [HD]", "Run Free"))

    def test_shared_qualifier_alone_is_no_agreement(self):
        # "(End Title)" on both sides must not hide a cross-language mismatch.
        self.assertTrue(is_title_mismatch("Me voilà (End Title)", "Here I Am (End Title)"))
        self.assertTrue(is_title_mismatch("Dégage ! (version single)", "Get Off My Back (Single Version)"))

    def test_diacritics_and_case_fold_together(self):
        self.assertFalse(is_title_mismatch("me voila", "Me Voilà"))

    def test_empty_or_noise_only_side_is_no_evidence(self):
        self.assertFalse(is_title_mismatch(None, "Run Free"))
        self.assertFalse(is_title_mismatch("", "Run Free"))
        self.assertFalse(is_title_mismatch("Official Video [HD]", "Run Free"))
        self.assertFalse(is_title_mismatch("Run Free", ""))

    def test_digits_alone_are_no_agreement(self):
        self.assertTrue(is_title_mismatch("Piste 01", "Intro 01"))


class TitlesAgreeTest(unittest.TestCase):
    def test_shared_real_word_agrees_across_diacritics(self):
        self.assertTrue(titles_agree("Me voila", "Me voilà (End Title)"))

    def test_disjoint_titles_do_not_agree(self):
        self.assertFalse(titles_agree("Me voilà", "Here I Am"))

    def test_noise_only_or_empty_side_never_agrees(self):
        self.assertFalse(titles_agree("Official Video", "Official Video"))
        self.assertFalse(titles_agree(None, "Me voilà"))
        self.assertFalse(titles_agree("Me voilà", ""))


class _Item(dict):
    """Stand-in for a beets Item: attribute-style title + dict flex attrs."""

    def __init__(self, title):
        super().__init__()
        self.title = title


class MarkTest(unittest.TestCase):
    def test_mismatch_sets_the_flag(self):
        item = _Item("Sound the Bugle")
        self.assertTrue(mark(item, "Sonne le clairon"))
        self.assertEqual(item[SUSPECT_MATCH], TITLE_MISMATCH)

    def test_healthy_match_clears_a_stale_flag(self):
        item = _Item("Sonne le clairon")
        item[SUSPECT_MATCH] = TITLE_MISMATCH
        self.assertFalse(mark(item, "Sonne le clairon"))
        self.assertNotIn(SUSPECT_MATCH, item)

    def test_hintless_match_clears_a_stale_flag(self):
        item = _Item("Sound the Bugle")
        item[SUSPECT_MATCH] = TITLE_MISMATCH
        self.assertFalse(mark(item, None))
        self.assertNotIn(SUSPECT_MATCH, item)

    def test_no_flag_no_delete(self):
        item = _Item("Run Free")
        self.assertFalse(mark(item, "Run Free"))
        self.assertNotIn(SUSPECT_MATCH, item)


if __name__ == "__main__":
    unittest.main()
