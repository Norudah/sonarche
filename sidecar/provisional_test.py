import unittest

import provisional


class _Item(dict):
    """Enough of a beets Item for `apply`: attribute access on `track`, mapping
    assignment for everything else."""

    track = 5

    def __setattr__(self, key, value):
        object.__setattr__(self, key, value)


class GuessFieldsTest(unittest.TestCase):
    def test_keeps_only_what_the_download_knew(self):
        self.assertEqual(
            provisional.guess_fields(title="You're a Lie", artist="Slash"),
            {"title": "You're a Lie", "artist": "Slash"},
        )

    def test_drops_empty_hints_rather_than_writing_blanks(self):
        self.assertEqual(provisional.guess_fields(title="", artist=None), {})

    def test_borrows_release_level_fields_from_siblings(self):
        fields = provisional.guess_fields(
            title="You're a Lie",
            album_fields={
                "album": "Apocalyptic Love",
                "albumartist": "Slash",
                "year": 2012,
                "mb_albumid": "rel-1",
                "month": 0,
                "genres": None,
            },
        )
        self.assertEqual(
            fields,
            {
                "title": "You're a Lie",
                "album": "Apocalyptic Love",
                "albumartist": "Slash",
                "year": 2012,
                "mb_albumid": "rel-1",
            },
        )

    def test_never_borrows_a_track_number(self):
        # A per-track truth nobody voted on; guessing it reorders the album.
        fields = provisional.guess_fields(album_fields={"album": "X", "track": 4})
        self.assertNotIn("track", fields)


class ApplyTest(unittest.TestCase):
    def test_writes_fields_and_raises_the_flag(self):
        item = _Item()
        self.assertTrue(provisional.apply(item, {"title": "A", "album": "B"}))
        self.assertEqual(item["title"], "A")
        self.assertEqual(item[provisional.FLAG], 1)

    def test_clears_the_playlist_position_parked_in_track(self):
        # _apply_hints puts the playlist index there in memory to help the text
        # search; it must never reach the database as a track number.
        item = _Item()
        provisional.apply(item, {"title": "A"})
        self.assertEqual(item.track, 0)

    def test_nothing_to_guess_leaves_the_item_untouched(self):
        item = _Item()
        self.assertFalse(provisional.apply(item, {}))
        self.assertNotIn(provisional.FLAG, item)
        self.assertEqual(item.track, 5)


if __name__ == "__main__":
    unittest.main()
