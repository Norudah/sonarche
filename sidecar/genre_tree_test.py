"""Regression tests for the tree-based bucket resolution
(run: python -m unittest genre_tree_test)."""

import unittest

from genre_tree import _FAMILIES, _genre_to_root, bucket_for, TREE_PATH, WHITELIST_PATH


class BucketForTest(unittest.TestCase):
    def test_every_family_root_maps_to_itself(self):
        for root, label in _FAMILIES.items():
            self.assertEqual(bucket_for(root), label, root)

    def test_specific_genre_climbs_to_its_family(self):
        self.assertEqual(bucket_for("thrash metal"), "Metal")
        self.assertEqual(bucket_for("crossover thrash"), "Metal")
        self.assertEqual(bucket_for("bossa nova"), "Latin")
        self.assertEqual(bucket_for("neo soul"), "Soul & Funk")
        self.assertEqual(bucket_for("gangsta rap"), "Hip-Hop")

    def test_guitar_industrial_is_metal_not_electronic(self):
        # Regression: industrial metal / NDH inherited "electronic" from the seed tree.
        self.assertEqual(bucket_for("Industrial Metal"), "Metal")
        self.assertEqual(bucket_for("Neue Deutsche Härte"), "Metal")
        self.assertEqual(bucket_for("industrial rock"), "Rock")

    def test_genuine_electronic_industrial_stays_electronic(self):
        for g in ("electronic body music", "death industrial", "power noise",
                  "electro-industrial", "power electronics"):
            self.assertEqual(bucket_for(g), "Electronic", g)

    def test_curated_boundaries_survive_the_default_tree(self):
        # These sit elsewhere in lastgenre's stock tree; ours must keep the
        # hand-picked family. (nu metal/grindcore browse as Rock by design.)
        self.assertEqual(bucket_for("nu metal"), "Rock")
        self.assertEqual(bucket_for("post-metal"), "Rock")
        self.assertEqual(bucket_for("stoner rock"), "Metal")
        self.assertEqual(bucket_for("synthcore"), "Electronic")
        self.assertEqual(bucket_for("contemporary r&b"), "Blues")
        self.assertEqual(bucket_for("new jack swing"), "Hip-Hop")
        self.assertEqual(bucket_for("ska"), "Reggae")
        self.assertEqual(bucket_for("ska punk"), "Rock")

    def test_non_family_sections_have_no_bucket(self):
        for g in ("afrobeat", "j-pop", "soundtrack", "lo-fi"):
            self.assertIsNone(bucket_for(g), g)

    def test_case_insensitive_and_trimmed(self):
        self.assertEqual(bucket_for("  THRASH Metal  "), "Metal")

    def test_unmapped_and_empty(self):
        self.assertIsNone(bucket_for("nonexistent genre"))
        self.assertIsNone(bucket_for(None))
        self.assertIsNone(bucket_for(""))


class TreeConsistencyTest(unittest.TestCase):
    def test_family_roots_exist_in_tree(self):
        mapping = _genre_to_root()
        for root in _FAMILIES:
            self.assertEqual(mapping.get(root), root, root)

    def test_whitelist_matches_tree_nodes(self):
        # The whitelist drives what lastgenre may store; the tree drives the
        # bucket. They must stay in sync: every tree node is whitelisted
        # (fabricated family roots excepted) and nothing else is.
        fabricated = {"soul & funk"}
        with open(WHITELIST_PATH, encoding="utf-8") as f:
            whitelist = {
                line.strip().lower()
                for line in f
                if line.strip() and not line.startswith("#")
            }
        nodes = set(_genre_to_root())
        self.assertEqual(nodes - whitelist, fabricated)
        self.assertEqual(whitelist - nodes, set())

    def test_tree_file_lives_next_to_module(self):
        # Both files ship as sidecar resources; the module resolves them by
        # absolute path (never via cwd).
        self.assertTrue(TREE_PATH.endswith("genres-tree.yaml"))
        self.assertTrue(WHITELIST_PATH.endswith("genres-whitelist.txt"))


if __name__ == "__main__":
    unittest.main()
