import unittest

from convert import extension_of, needs_conversion


class ExtensionTest(unittest.TestCase):
    def test_reads_the_suffix_without_its_dot(self):
        self.assertEqual(extension_of("/Music/Library/Muse/Origin/01 Kill.MP3"), "mp3")

    def test_a_name_with_no_suffix_has_none(self):
        self.assertEqual(extension_of("/Music/Library/Muse/Origin/01 Kill"), "")
        self.assertEqual(extension_of(""), "")


class NeedsConversionTest(unittest.TestCase):
    def test_a_file_already_in_the_target_format_is_left_alone(self):
        self.assertFalse(needs_conversion("a.mp3", "mp3"))
        self.assertFalse(needs_conversion("a.FLAC", "flac"))

    def test_anything_else_is_re_encoded(self):
        self.assertTrue(needs_conversion("a.m4a", "mp3"))
        self.assertTrue(needs_conversion("a.mp3", "flac"))
        self.assertTrue(needs_conversion("a.wav", "m4a"))

    def test_the_mp4_container_under_its_other_names_is_already_m4a(self):
        """Re-encoding an `.m4b` or an `.mp4` to `.m4a` would burn a generation
        of quality to change three letters — same container, same codec."""
        self.assertFalse(needs_conversion("book.m4b", "m4a"))
        self.assertFalse(needs_conversion("clip.mp4", "m4a"))
        # Only towards m4a: to mp3 they are as much a re-encode as anything.
        self.assertTrue(needs_conversion("book.m4b", "mp3"))

    def test_a_path_with_no_suffix_is_not_guessed_at(self):
        # Nothing says what it holds, and converting it would be a coin flip on
        # someone's audio.
        self.assertFalse(needs_conversion("/Music/Library/Muse/Origin/01 Kill", "mp3"))


if __name__ == "__main__":
    unittest.main()
