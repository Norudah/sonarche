"""Pure tests for the LRC parsing and candidate ranking (run: python -m unittest lyrics_test).

Nothing here touches the network: `fetch` is a thin shell around these two, and
they are where a wrong answer would show up as the wrong song scrolling past."""

import unittest

import lyrics


class ParseLrcTest(unittest.TestCase):
    def test_reads_minutes_seconds_and_hundredths(self):
        parsed = lyrics.parse_lrc("[01:17.45] It might not be the right time")
        self.assertEqual(parsed, [{"time": 77.45, "text": "It might not be the right time"}])

    def test_accepts_a_colon_before_the_fraction(self):
        self.assertEqual(lyrics.parse_lrc("[00:09:50] Hey")[0]["time"], 9.5)

    def test_drops_header_tags(self):
        parsed = lyrics.parse_lrc("[ar:Daft Punk]\n[length: 3:52]\n[00:12.00] Line")
        self.assertEqual([line["text"] for line in parsed], ["Line"])

    def test_repeats_a_line_for_each_of_its_stamps(self):
        parsed = lyrics.parse_lrc("[00:10.00][01:20.00] Chorus")
        self.assertEqual([line["time"] for line in parsed], [10.0, 80.0])

    def test_keeps_timed_blank_lines(self):
        parsed = lyrics.parse_lrc("[00:01.00] Verse\n[00:05.00]\n[00:09.00] Next")
        self.assertEqual([line["text"] for line in parsed], ["Verse", "", "Next"])

    def test_sorts_by_time(self):
        parsed = lyrics.parse_lrc("[00:30.00] Second\n[00:10.00] First")
        self.assertEqual([line["text"] for line in parsed], ["First", "Second"])

    def test_ignores_untimed_text(self):
        self.assertEqual(lyrics.parse_lrc("just a plain line"), [])


class StripStampsTest(unittest.TestCase):
    def test_yields_the_readable_body(self):
        self.assertEqual(lyrics.strip_stamps("[00:01.00] One\n[00:04.00] Two"), "One\nTwo")


class PayloadTest(unittest.TestCase):
    """The wire contract with `shared/player/lyrics.ts`, which declares these
    five keys by hand. A rename on this side has to fail here rather than reach
    the panel as an `undefined`."""

    def test_carries_every_field_the_front_reads(self):
        payload = lyrics._payload("lrclib", "Words", "[00:01.00] Words")
        self.assertEqual(set(payload), {"source", "plain", "lines", "instrumental", "unreachable"})
        self.assertEqual(payload["source"], "lrclib")
        self.assertEqual(payload["lines"], [{"time": 1.0, "text": "Words"}])
        self.assertFalse(payload["instrumental"])
        self.assertFalse(payload["unreachable"])

    def test_empty_text_reads_as_absent(self):
        payload = lyrics._payload(None, "", "", unreachable=True)
        self.assertIsNone(payload["plain"])
        self.assertEqual(payload["lines"], [])
        self.assertTrue(payload["unreachable"])


class PickCandidateTest(unittest.TestCase):
    def _hit(self, duration, synced=None, plain="Words"):
        return {"duration": duration, "syncedLyrics": synced, "plainLyrics": plain}

    def test_drops_hits_whose_length_disagrees(self):
        self.assertIsNone(lyrics.pick_candidate([self._hit(135.0)], duration=233.0))

    def test_prefers_timed_over_plain_within_tolerance(self):
        plain = self._hit(233.0)
        timed = self._hit(235.0, synced="[00:01.00] One")
        self.assertIs(lyrics.pick_candidate([plain, timed], duration=233.0), timed)

    def test_falls_back_to_the_closest_length(self):
        near = self._hit(232.0)
        far = self._hit(235.0)
        self.assertIs(lyrics.pick_candidate([far, near], duration=233.0), near)

    def test_ignores_empty_entries(self):
        empty = {"duration": 233.0, "syncedLyrics": None, "plainLyrics": ""}
        self.assertIsNone(lyrics.pick_candidate([empty], duration=233.0))

    def test_keeps_every_hit_when_the_file_has_no_length(self):
        hit = self._hit(135.0)
        self.assertIs(lyrics.pick_candidate([hit], duration=None), hit)
