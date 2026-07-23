"""Pure tests for the provenance traces (run: python -m unittest provenance_test)."""

import unittest

import provenance


class _FakeItem:
    """Enough of a beets Item for the marks: flexible-attribute set + get."""

    def __init__(self):
        self.attrs = {}

    def __setitem__(self, key, value):
        self.attrs[key] = value

    def get(self, key, default=None):
        return self.attrs.get(key, default)


class MarkEditedTest(unittest.TestCase):
    def test_records_timestamp_and_fields(self):
        item = _FakeItem()
        provenance.mark_edited(item, {"year"}, now="2026-07-23T10:00:00Z")
        self.assertEqual(item.get(provenance.EDITED_AT), "2026-07-23T10:00:00Z")
        self.assertEqual(item.get(provenance.EDITED_FIELDS), "year")

    def test_fields_accumulate_across_edits(self):
        """Editing the year and later the genre leaves both on record: the
        trail answers "what did a human vouch for", not "what moved last"."""
        item = _FakeItem()
        provenance.mark_edited(item, {"year"}, now="2026-07-23T10:00:00Z")
        provenance.mark_edited(item, {"title", "genres"}, now="2026-07-24T09:00:00Z")
        self.assertEqual(item.get(provenance.EDITED_FIELDS), "genres,title,year")
        self.assertEqual(item.get(provenance.EDITED_AT), "2026-07-24T09:00:00Z")

    def test_re_editing_a_known_field_does_not_duplicate_it(self):
        item = _FakeItem()
        provenance.mark_edited(item, {"year"}, now="2026-07-23T10:00:00Z")
        provenance.mark_edited(item, {"year"}, now="2026-07-24T09:00:00Z")
        self.assertEqual(item.get(provenance.EDITED_FIELDS), "year")

    def test_default_timestamp_is_utc_iso_seconds(self):
        item = _FakeItem()
        provenance.mark_edited(item, {"year"})
        self.assertRegex(
            item.get(provenance.EDITED_AT), r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$"
        )


class WasHandEditedTest(unittest.TestCase):
    def test_true_for_a_recorded_field(self):
        item = _FakeItem()
        provenance.mark_edited(item, {"genres", "year"}, now="2026-07-23T10:00:00Z")
        self.assertTrue(provenance.was_hand_edited(item, "genres"))

    def test_a_field_name_never_matches_as_substring(self):
        """"genre" must not match the recorded "genres" — the trail compares
        whole attribute names, not text."""
        item = _FakeItem()
        provenance.mark_edited(item, {"genres"}, now="2026-07-23T10:00:00Z")
        self.assertFalse(provenance.was_hand_edited(item, "genre"))

    def test_false_for_an_untouched_field_or_no_trail(self):
        item = _FakeItem()
        provenance.mark_edited(item, {"year"}, now="2026-07-23T10:00:00Z")
        self.assertFalse(provenance.was_hand_edited(item, "genres"))
        self.assertFalse(provenance.was_hand_edited(_FakeItem(), "genres"))


class MarkMatchTest(unittest.TestCase):
    def test_records_the_source(self):
        item = _FakeItem()
        provenance.mark_match(item, "acoustid")
        self.assertEqual(item.get(provenance.MATCH_SOURCE), "acoustid")

    def test_fingerprinted_is_a_flag(self):
        item = _FakeItem()
        provenance.mark_fingerprinted(item)
        self.assertEqual(item.get(provenance.FINGERPRINTED), 1)


if __name__ == "__main__":
    unittest.main()
