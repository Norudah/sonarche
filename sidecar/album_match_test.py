import unittest

from album_match import cover_with_editions


def _release(date="2001", secondary=()):
    return {
        "release_group": {"primary_type": "Album", "secondary_types": list(secondary)},
        "date": date,
    }


class CoverWithEditionsTest(unittest.TestCase):
    def test_one_edition_holding_every_leftover_takes_them_all(self):
        deluxe = _release()
        candidates = {
            1: {"deluxe": (deluxe, "r1"), "japan": (_release(), "r1")},
            2: {"deluxe": (deluxe, "r2")},
        }
        self.assertEqual(cover_with_editions(candidates), {"deluxe": [(1, "r1"), (2, "r2")]})

    def test_leftovers_only_one_edition_has_go_to_it(self):
        candidates = {
            1: {"deluxe": (_release(), "r1")},
            2: {"deluxe": (_release(), "r2")},
            3: {"japan": (_release(), "r3")},
        }
        self.assertEqual(
            cover_with_editions(candidates),
            {"deluxe": [(1, "r1"), (2, "r2")], "japan": [(3, "r3")]},
        )

    def test_a_tie_goes_to_the_better_ranked_release(self):
        live = _release(date="1999", secondary=["Live"])
        studio = _release(date="2005")
        candidates = {1: {"live": (live, "r1"), "studio": (studio, "r1")}}
        self.assertEqual(cover_with_editions(candidates), {"studio": [(1, "r1")]})

    def test_nothing_to_cover(self):
        self.assertEqual(cover_with_editions({}), {})


if __name__ == "__main__":
    unittest.main()
