import os
import shutil
import tempfile
import unittest

from undo_removal import under


class UnderTest(unittest.TestCase):
    """The guard that keeps an undo from deleting files outside the library."""

    def setUp(self):
        self.base = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.base, True)
        self.library = os.path.join(self.base, "Music")
        os.makedirs(os.path.join(self.library, "Album"))

    def test_a_file_in_a_subfolder_is_under(self):
        self.assertTrue(under(os.path.join(self.library, "Album", "t.m4a"), self.library))

    def test_a_sibling_sharing_the_prefix_is_not_under(self):
        # "/Music2/x" starts with "/Music" as a string, not as a path.
        self.assertFalse(under(os.path.join(self.base, "Music2", "t.m4a"), self.library))

    def test_climbing_out_with_dotdot_is_not_under(self):
        self.assertFalse(under(os.path.join(self.library, "..", "t.m4a"), self.library))

    def test_a_symlinked_library_resolves_both_sides(self):
        link = os.path.join(self.base, "link")
        os.symlink(self.library, link)
        self.assertTrue(under(os.path.join(link, "Album", "t.m4a"), self.library))
        self.assertTrue(under(os.path.join(self.library, "Album", "t.m4a"), link))


if __name__ == "__main__":
    unittest.main()
