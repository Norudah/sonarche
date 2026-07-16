"""Regression tests for probe.summarize (run: python -m unittest probe_test)."""

import unittest

from probe import summarize


def _playlist(entries, **extra):
    return {"_type": "playlist", "title": "Mutter", "uploader": "Rammstein", "entries": entries, **extra}


def _entry(video_id, title, duration=200.0, url=None):
    return {"id": video_id, "title": title, "duration": duration, "url": url}


class SummarizeTest(unittest.TestCase):
    def test_playlist(self):
        info = _playlist([_entry("a1", "Mein Herz brennt", 279.0, "https://youtube.com/watch?v=a1")])
        out = summarize(info, max_entries=10)
        self.assertTrue(out["is_playlist"])
        self.assertEqual(out["title"], "Mutter")
        self.assertEqual(out["artist"], "Rammstein")
        self.assertEqual(out["count"], 1)
        self.assertEqual(out["entries"][0]["url"], "https://youtube.com/watch?v=a1")

    def test_single_video(self):
        info = {"title": "Sonne", "uploader": "Rammstein", "duration": 272.0}
        out = summarize(info, max_entries=10)
        self.assertFalse(out["is_playlist"])
        self.assertEqual(out["title"], "Sonne")
        self.assertEqual(out["artist"], "Rammstein")

    def test_single_prefers_track_and_artist_fields(self):
        info = {"title": "Sonne (Official Video)", "track": "Sonne", "artist": "Rammstein", "uploader": "RammsteinVEVO"}
        out = summarize(info, max_entries=10)
        self.assertEqual(out["title"], "Sonne")
        self.assertEqual(out["artist"], "Rammstein")

    def test_oversized_playlist_raises(self):
        info = _playlist([_entry(f"v{i}", f"Track {i}") for i in range(5)])
        with self.assertRaises(RuntimeError):
            summarize(info, max_entries=4)

    def test_empty_playlist_raises(self):
        with self.assertRaises(RuntimeError):
            summarize(_playlist([]), max_entries=10)

    def test_none_entries_are_dropped(self):
        # yt-dlp yields None stubs for unavailable/deleted videos.
        info = _playlist([None, _entry("a1", "Track 1")])
        out = summarize(info, max_entries=10)
        self.assertEqual(out["count"], 1)

    def test_missing_duration_and_url_tolerated(self):
        # Flat extraction sometimes omits duration; url falls back to the watch URL.
        info = _playlist([{"id": "a1", "title": "Track 1"}])
        out = summarize(info, max_entries=10)
        entry = out["entries"][0]
        self.assertIsNone(entry["duration"])
        self.assertEqual(entry["url"], "https://www.youtube.com/watch?v=a1")

    def test_channel_fallback_for_artist(self):
        info = _playlist([_entry("a1", "Track 1")])
        del info["uploader"]
        info["channel"] = "Rammstein - Topic"
        self.assertEqual(summarize(info, max_entries=10)["artist"], "Rammstein - Topic")


if __name__ == "__main__":
    unittest.main()
