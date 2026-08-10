import unittest

from beetsplug.sonarche_import import parse_stem, unpack_year


class ParseStemTest(unittest.TestCase):
    """Stems from the real user folder that motivated the plugin, plus the
    shapes an album rip uses."""

    def test_artist_and_title_split_on_the_spaced_hyphen(self):
        artist, track, title = parse_stem("In Love With A Ghost  - We've Never Met")
        self.assertEqual(artist, "In Love With A Ghost")
        self.assertIsNone(track)
        self.assertEqual(title, "We've Never Met")

    def test_non_latin_artists_split_the_same_way(self):
        artist, _, title = parse_stem("ミカヅキBIGWAVE - Fancy You")
        self.assertEqual(artist, "ミカヅキBIGWAVE")
        self.assertEqual(title, "Fancy You")

    def test_a_leading_number_is_a_track_not_an_artist(self):
        self.assertEqual(parse_stem("01 - One More Time"), (None, 1, "One More Time"))
        self.assertEqual(parse_stem("02. Digital Love"), (None, 2, "Digital Love"))
        self.assertEqual(parse_stem("3_Nightcall"), (None, 3, "Nightcall"))

    def test_an_unspaced_hyphen_never_splits_a_name(self):
        # `AC-DC` is a band, not "AC" singing "DC".
        self.assertEqual(parse_stem("AC-DC"), (None, None, "AC-DC"))

    def test_a_plain_stem_is_the_title(self):
        self.assertEqual(parse_stem("Nightcall"), (None, None, "Nightcall"))

    def test_an_empty_stem_yields_nothing(self):
        self.assertEqual(parse_stem("   "), (None, None, None))

    def test_a_hyphenated_artist_with_a_spaced_split_still_works(self):
        artist, _, title = parse_stem("Jay-Z - 99 Problems")
        self.assertEqual(artist, "Jay-Z")
        self.assertEqual(title, "99 Problems")


class UnpackYearTest(unittest.TestCase):
    def test_a_packed_date_splits_into_its_parts(self):
        self.assertEqual(unpack_year(20240927), (2024, 9, 27))

    def test_an_ordinary_year_is_left_alone(self):
        self.assertIsNone(unpack_year(2024))
        self.assertIsNone(unpack_year(0))
        self.assertIsNone(unpack_year(None))

    def test_a_packed_value_with_an_impossible_date_still_gives_its_year(self):
        self.assertEqual(unpack_year(20241399), (2024, 0, 0))

    def test_a_six_digit_value_gives_its_year(self):
        self.assertEqual(unpack_year(202409), (2024, 0, 0))

    def test_garbage_beyond_repair_is_refused(self):
        # First four digits do not make a year anyone tagged on purpose.
        self.assertIsNone(unpack_year(99999999))
