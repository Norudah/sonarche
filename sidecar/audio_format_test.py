import unittest

import audio_format


class NormalizeTest(unittest.TestCase):
    def test_reads_back_every_offered_format(self):
        for fmt in audio_format.FORMATS:
            self.assertEqual(audio_format.normalize(fmt), fmt)

    def test_tolerates_the_shapes_a_setting_arrives_in(self):
        self.assertEqual(audio_format.normalize("MP3"), "mp3")
        self.assertEqual(audio_format.normalize(" .flac "), "flac")

    def test_anything_unreadable_is_the_default(self):
        # A preference file from another build, a hand-edit, a null. None of
        # them may stop a download.
        self.assertEqual(audio_format.normalize(None), "m4a")
        self.assertEqual(audio_format.normalize(""), "m4a")
        self.assertEqual(audio_format.normalize("wav"), "m4a")


class NativeTest(unittest.TestCase):
    def test_only_the_downloaded_stream_counts_as_native(self):
        self.assertTrue(audio_format.is_native("m4a"))
        self.assertTrue(audio_format.is_native(None))
        self.assertFalse(audio_format.is_native("mp3"))
        self.assertFalse(audio_format.is_native("flac"))


class EncoderTest(unittest.TestCase):
    def test_mp3_goes_through_lame_at_its_top_vbr_setting(self):
        self.assertEqual(
            audio_format.encoder_args("mp3"), ["-vn", "-c:a", "libmp3lame", "-q:a", "0"]
        )

    def test_flac_is_the_lossless_encoder_not_a_copy(self):
        self.assertIn("-c:a", audio_format.encoder_args("flac"))
        self.assertIn("flac", audio_format.encoder_args("flac"))

    def test_every_format_drops_the_attached_picture(self):
        # Each container spells cover art differently; one writer re-embeds it
        # afterwards rather than three ffmpeg incantations trying to carry it.
        for fmt in audio_format.FORMATS:
            self.assertIn("-vn", audio_format.encoder_args(fmt))

    def test_the_command_line_reads_like_the_one_you_would_type(self):
        self.assertEqual(
            audio_format.ffmpeg_command("/ff", "/in.m4a", "/out.mp3", "mp3"),
            [
                "/ff",
                "-hide_banner",
                "-loglevel",
                "error",
                "-nostdin",
                "-y",
                "-i",
                "/in.m4a",
                "-vn",
                "-c:a",
                "libmp3lame",
                "-q:a",
                "0",
                "/out.mp3",
            ],
        )


class DownloadOptionsTest(unittest.TestCase):
    def test_the_native_format_adds_no_postprocessor(self):
        """The app's own rule, expressed as an empty list: with nothing in the
        chain, yt-dlp writes the stream it downloaded byte for byte."""
        self.assertEqual(audio_format.postprocessors("m4a"), [])

    def test_a_transcode_extracts_through_ffmpeg(self):
        chain = audio_format.postprocessors("mp3")
        self.assertEqual(len(chain), 1)
        self.assertEqual(chain[0]["key"], "FFmpegExtractAudio")
        self.assertEqual(chain[0]["preferredcodec"], "mp3")

    def test_native_asks_for_the_stream_by_name(self):
        self.assertEqual(audio_format.source_selector("m4a"), "bestaudio[ext=m4a]/bestaudio")

    def test_a_transcode_asks_for_the_best_source_of_any_kind(self):
        # The encoder decodes it either way; the widest source is the one that
        # survives the re-encode best.
        self.assertEqual(audio_format.source_selector("flac"), "bestaudio/best")


if __name__ == "__main__":
    unittest.main()
