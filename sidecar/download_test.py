"""Regression tests for download's error classification
(run: python -m unittest download_test)."""

import unittest

from download import UNAVAILABLE_PREFIX, is_unavailable_error, scrub


class UnavailableErrorTest(unittest.TestCase):
    """A playlist keeps listing videos the source has since pulled: full title,
    duration and channel, indistinguishable from a healthy entry until the
    download is attempted. This is where that verdict is made — get it wrong
    and either a dead slot is retried forever, or a genuine network failure is
    written off as gone."""

    def test_recognizes_the_message_the_cars_playlist_produced(self):
        # Captured verbatim from yt-dlp on the user's own playlist.
        self.assertTrue(
            is_unavailable_error(
                "ERROR: [youtube] DwGCOMGwq34: Video unavailable. "
                "This video is not available"
            )
        )

    def test_recognizes_the_other_ways_a_video_goes_away(self):
        for message in (
            "ERROR: [youtube] abc: Private video. Sign in if you've been granted access",
            "ERROR: [youtube] abc: This video has been removed by the uploader",
            "ERROR: [youtube] abc: The uploader has not made this video available in your country",
            "ERROR: [youtube] abc: Video unavailable. This video contains content from X, "
            "who has blocked it in your country",
        ):
            self.assertTrue(is_unavailable_error(message), message)

    def test_a_real_download_failure_is_not_written_off_as_gone(self):
        # These must stay retryable: the video is fine, the run was not.
        for message in (
            "ERROR: unable to download video data: HTTP Error 403: Forbidden",
            "ERROR: [youtube] abc: Sign in to confirm you're not a bot",
            "ERROR: Unable to download webpage: <urlopen error timed out>",
            "ERROR: Postprocessing: ffmpeg not found",
        ):
            self.assertFalse(is_unavailable_error(message), message)

    def test_says_nothing_about_an_empty_message(self):
        self.assertFalse(is_unavailable_error(""))
        self.assertFalse(is_unavailable_error(None))

    def test_the_marker_is_a_stable_prefix_for_the_caller(self):
        # Rust matches on this exact string; changing it silently would turn
        # every gone video back into a red, endlessly retried failure.
        self.assertEqual(UNAVAILABLE_PREFIX, "video-unavailable:")


class ScrubTest(unittest.TestCase):
    """Errors land in the download history and on the failing row. The app
    never names the site it fetches from, so the extractor tag comes off — but
    what actually went wrong has to survive, or a failed row says nothing."""

    def test_drops_the_extractor_tag_and_the_video_id(self):
        self.assertEqual(
            scrub("ERROR: [youtube] DwGCOMGwq34: Video unavailable. This video is not available"),
            "Video unavailable. This video is not available",
        )

    def test_keeps_the_reason_intact(self):
        self.assertEqual(
            scrub("ERROR: [youtube] abc: Sign in to confirm you're not a bot"),
            "Sign in to confirm you're not a bot",
        )

    def test_handles_an_error_with_no_tag_at_all(self):
        self.assertEqual(
            scrub("ERROR: unable to download video data: HTTP Error 403: Forbidden"),
            "unable to download video data: HTTP Error 403: Forbidden",
        )

    def test_never_leaves_a_site_name_behind(self):
        for message in (
            "ERROR: [youtube] abc: Video unavailable",
            "ERROR: [youtube:tab] PL123: The playlist does not exist",
            # Any tag at all, not just the ones we expect: the extractor name is
            # yt-dlp's to change, and the scrub has to hold whatever it prints.
            "ERROR: [somewhere] 123: Track is not available",
        ):
            self.assertNotIn("[", scrub(message), message)

    def test_survives_an_empty_message(self):
        self.assertEqual(scrub(""), "")
        self.assertEqual(scrub(None), "")


if __name__ == "__main__":
    unittest.main()
