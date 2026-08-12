"""Regression tests for the user genre placements
(run: python -m unittest genre_overrides_test)."""

import json
import os
import tempfile
import unittest
from unittest import mock

import genre_overrides
import genre_tree
from genre_overrides import (
    DERIVED_TREE_NAME,
    DERIVED_WHITELIST_NAME,
    ENV_DIR,
    OVERRIDES_NAME,
    list_overrides,
    load,
    set_family,
)
from genre_tree import bucket_for


class OverridesTestCase(unittest.TestCase):
    """Every test runs against a throwaway genres dir and a cold cache."""

    def setUp(self):
        self._dir = tempfile.TemporaryDirectory()
        self._env = mock.patch.dict(os.environ, {ENV_DIR: self._dir.name})
        self._env.start()
        genre_overrides._cache = None
        # The tests never touch a live beets, so the plugin refresh is a no-op;
        # silence it to keep failure output readable.
        self._refresh = mock.patch.object(genre_overrides, "_refresh_lastgenre")
        self._refresh.start()

    def tearDown(self):
        self._refresh.stop()
        self._env.stop()
        self._dir.cleanup()
        genre_overrides._cache = None

    def _derived_tree(self):
        import yaml

        with open(os.path.join(self._dir.name, DERIVED_TREE_NAME), encoding="utf-8") as f:
            return yaml.safe_load(f)

    def _derived_whitelist(self):
        with open(os.path.join(self._dir.name, DERIVED_WHITELIST_NAME), encoding="utf-8") as f:
            return {
                line.strip().lower()
                for line in f
                if line.strip() and not line.startswith("#")
            }

    def _roots_of(self, tree, genre):
        """Every top-level root the genre appears under, in the derived tree."""
        roots = []

        def walk(children, root):
            for node in children:
                if isinstance(node, dict):
                    for name, sub in node.items():
                        if str(name).lower() == genre:
                            roots.append(root)
                        walk(sub or [], root)
                elif str(node).lower() == genre:
                    roots.append(root)

        for top in tree:
            if isinstance(top, dict):
                for root, children in top.items():
                    if str(root).lower() == genre:
                        roots.append(str(root).lower())
                    walk(children or [], str(root).lower())
            elif str(top).lower() == genre:
                roots.append(str(top).lower())
        return roots


class SetFamilyTest(OverridesTestCase):
    def test_adopting_an_unknown_genre_gives_it_a_family(self):
        self.assertIsNone(bucket_for("hyperpop"))
        result = set_family("Hyperpop", "Electronic")
        self.assertEqual(result["family"], "Electronic")
        self.assertTrue(result["overridden"])
        self.assertEqual(bucket_for("hyperpop"), "Electronic")
        self.assertEqual(bucket_for("  HYPERpop "), "Electronic")

    def test_adopted_genre_reaches_the_derived_whitelist_and_tree(self):
        set_family("hyperpop", "Electronic")
        self.assertIn("hyperpop", self._derived_whitelist())
        self.assertEqual(self._roots_of(self._derived_tree(), "hyperpop"), ["electronic"])

    def test_reclassing_a_known_genre_moves_its_bucket(self):
        self.assertEqual(bucket_for("dream pop"), "Rock")
        set_family("dream pop", "Pop")
        self.assertEqual(bucket_for("dream pop"), "Pop")
        self.assertEqual(self._roots_of(self._derived_tree(), "dream pop"), ["pop"])

    def test_duplicated_base_nodes_are_all_stripped(self):
        # "funk metal" sits twice under metal in the bundled tree; a leftover
        # copy would keep canonicalizing against the old placement.
        set_family("funk metal", "Rock")
        self.assertEqual(self._roots_of(self._derived_tree(), "funk metal"), ["rock"])

    def test_clearing_returns_to_the_base_tree(self):
        set_family("dream pop", "Pop")
        result = set_family("dream pop", None)
        self.assertEqual(result["family"], "Rock")
        self.assertFalse(result["overridden"])
        self.assertEqual(load(), {})

    def test_restating_the_base_placement_stores_nothing(self):
        result = set_family("dream pop", "Rock")
        self.assertFalse(result["overridden"])
        self.assertEqual(load(), {})
        set_family("dream pop", "Pop")
        result = set_family("dream pop", "Rock")
        self.assertFalse(result["overridden"])
        self.assertEqual(load(), {})

    def test_unknown_family_is_refused(self):
        with self.assertRaises(RuntimeError):
            set_family("dream pop", "Chiptune")

    def test_a_family_root_is_not_a_movable_genre(self):
        with self.assertRaises(RuntimeError):
            set_family("hip hop", "Rock")

    def test_empty_genre_is_refused(self):
        with self.assertRaises(RuntimeError):
            set_family("   ", "Rock")

    def test_list_reports_labels(self):
        set_family("hyperpop", "Electronic")
        set_family("dream pop", "Pop")
        self.assertEqual(
            list_overrides(),
            [
                {"genre": "dream pop", "family": "Pop"},
                {"genre": "hyperpop", "family": "Electronic"},
            ],
        )

    def test_derived_tree_still_resolves_everything_else(self):
        set_family("dream pop", "Pop")
        tree = self._derived_tree()
        self.assertEqual(self._roots_of(tree, "thrash metal"), ["metal"])
        self.assertEqual(self._roots_of(tree, "bossa nova"), ["latin"])


class RobustnessTest(OverridesTestCase):
    def test_unreadable_overrides_file_resolves_as_empty(self):
        with open(os.path.join(self._dir.name, OVERRIDES_NAME), "w", encoding="utf-8") as f:
            f.write("{not json")
        genre_overrides._cache = None
        self.assertEqual(load(), {})
        self.assertEqual(bucket_for("thrash metal"), "Metal")

    def test_overrides_survive_a_reload(self):
        set_family("hyperpop", "Electronic")
        genre_overrides._cache = None
        self.assertEqual(bucket_for("hyperpop"), "Electronic")

    def test_a_write_from_another_process_is_seen_without_invalidation(self):
        # The sidecar runs as two processes: the write lands on the work
        # channel, the listing is served by the read channel. This is the read
        # process: its cache is warm, nothing ever pokes it — only the file's
        # stamp can tell it the placements moved.
        self.assertIsNone(bucket_for("hyperpop"))  # warm the cache
        payload = {"version": 1, "families": {"hyperpop": "electronic"}}
        with open(os.path.join(self._dir.name, OVERRIDES_NAME), "w", encoding="utf-8") as f:
            json.dump(payload, f)
        self.assertEqual(bucket_for("hyperpop"), "Electronic")

    def test_a_deleted_file_empties_the_placements(self):
        set_family("hyperpop", "Electronic")
        os.remove(os.path.join(self._dir.name, OVERRIDES_NAME))
        self.assertIsNone(bucket_for("hyperpop"))

    def test_legacy_family_roots_resolve_to_their_heirs(self):
        # Placements written before the 2026-08 family audit name roots that
        # no longer exist; they must keep working without rewriting the file.
        payload = {
            "version": 1,
            "families": {"quiet storm": "soul & funk", "americana rock": "country"},
        }
        with open(os.path.join(self._dir.name, OVERRIDES_NAME), "w", encoding="utf-8") as f:
            json.dump(payload, f)
        self.assertEqual(bucket_for("quiet storm"), "R&B, Soul & Funk")
        self.assertEqual(bucket_for("americana rock"), "Folk & Country")

    def test_saved_file_is_versioned_json(self):
        set_family("hyperpop", "Electronic")
        with open(os.path.join(self._dir.name, OVERRIDES_NAME), encoding="utf-8") as f:
            data = json.load(f)
        self.assertEqual(data["version"], 1)
        self.assertEqual(data["families"], {"hyperpop": "electronic"})

    def test_without_env_dir_the_read_path_is_untouched(self):
        self._env.stop()
        genre_overrides._cache = None
        try:
            self.assertEqual(load(), {})
            self.assertEqual(bucket_for("thrash metal"), "Metal")
        finally:
            self._env.start()


class DerivedFilesTest(OverridesTestCase):
    def test_ensure_derived_writes_both_files_without_overrides(self):
        genre_overrides.ensure_derived()
        self.assertTrue(os.path.exists(os.path.join(self._dir.name, DERIVED_TREE_NAME)))
        self.assertTrue(os.path.exists(os.path.join(self._dir.name, DERIVED_WHITELIST_NAME)))

    def test_pristine_derived_tree_matches_the_base(self):
        import yaml

        genre_overrides.ensure_derived()
        with open(genre_tree.TREE_PATH, encoding="utf-8") as f:
            base = yaml.safe_load(f)
        self.assertEqual(self._derived_tree(), base)

    def test_pristine_derived_whitelist_matches_the_base(self):
        genre_overrides.ensure_derived()
        with open(genre_tree.WHITELIST_PATH, encoding="utf-8") as f:
            base = {
                line.strip().lower()
                for line in f
                if line.strip() and not line.startswith("#")
            }
        self.assertEqual(self._derived_whitelist(), base)


if __name__ == "__main__":
    unittest.main()
