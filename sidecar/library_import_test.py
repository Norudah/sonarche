import unittest

import import_recap
from library_import import GROUPINGS, _import_command


class ImportCommandTest(unittest.TestCase):
    def _cmd(self, grouping="folder", category=None):
        return _import_command("/cfg.yaml", "/music", grouping, "batch-1", category)

    def test_copies_and_never_moves_the_originals(self):
        cmd = self._cmd()
        # The config says `move: yes`, which beets checks before `copy`.
        self.assertIn("-M", cmd)
        self.assertIn("-c", cmd)
        self.assertIn("-A", cmd)

    def test_stamps_the_batch_and_ends_on_the_folder(self):
        cmd = self._cmd()
        self.assertIn(f"--set={import_recap.BATCH_FIELD}=batch-1", cmd)
        self.assertEqual(cmd[-1], "/music")

    def test_grouping_flag_follows_the_choice(self):
        for grouping, flags in GROUPINGS.items():
            cmd = self._cmd(grouping)
            for flag in ("-g", "-s"):
                self.assertEqual(flag in cmd, flag in flags, (grouping, flag))

    def test_a_blank_category_sets_no_grouping(self):
        self.assertFalse(any(arg.startswith("--set=grouping=") for arg in self._cmd(category="  ")))
        self.assertIn("--set=grouping=Films", self._cmd(category=" Films "))


if __name__ == "__main__":
    unittest.main()
