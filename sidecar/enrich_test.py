"""Regression tests for enrich's pure functions
(run: python -m unittest enrich_test)."""

import unittest

from enrich import work_fields


class WorkFieldsTest(unittest.TestCase):
    def test_drops_the_release_duration(self):
        # The regression this exists for: MusicBrainz' duration for the
        # recording replaced the downloaded file's own, and every duration in
        # the app inherited it.
        merged = {"title": "Vantablack", "artist": "Perturbator", "length": 304.4}
        self.assertEqual(work_fields(merged), {"title": "Vantablack", "artist": "Perturbator"})

    def test_keeps_everything_that_describes_the_work(self):
        merged = {
            "title": "God Complex",
            "artist": "Perturbator",
            "album": "New Model",
            "year": 2017,
            "index": 6,
            "mb_trackid": "abc",
        }
        self.assertEqual(work_fields(merged), merged)

    def test_survives_a_release_with_no_duration_at_all(self):
        self.assertEqual(work_fields({"title": "Halo"}), {"title": "Halo"})

    def test_returns_a_plain_dict_not_a_view_of_the_input(self):
        merged = {"title": "Java", "length": 197.0}
        result = work_fields(merged)
        result["title"] = "changed"
        self.assertEqual(merged["title"], "Java")


if __name__ == "__main__":
    unittest.main()


class CandidateSortKeyTest(unittest.TestCase):
    """The Real Gone regression: one fingerprint, two linked recordings, and
    the wrong one first by AcoustID submission count. The video title is the
    signal that survives, so it must outrank the release type."""

    STUDIO = {"status": "Official", "release_group": {"primary_type": "Album"}, "date": "2005"}
    SOUNDTRACK = {
        "status": "Official",
        "release_group": {"primary_type": "Album", "secondary_types": ["Soundtrack"]},
        "date": "2006",
    }

    def test_the_title_the_video_names_beats_a_better_ranked_release(self):
        from enrich import candidate_sort_key

        hint = "Sheryl Crow - Real Gone (Cars Soundtrack)"
        # The mislinked recording resolves to a clean studio album; the right
        # one only lives on the soundtrack. The old order picked the wrong song.
        wrong = candidate_sort_key(hint, "Sleepin' on the Foldout", self.STUDIO)
        right = candidate_sort_key(hint, "Real Gone", self.SOUNDTRACK)
        self.assertLess(right, wrong)

    def test_release_rank_still_arbitrates_between_agreeing_titles(self):
        from enrich import candidate_sort_key

        hint = "Real Gone"
        album = candidate_sort_key(hint, "Real Gone", self.STUDIO)
        compilation = candidate_sort_key(hint, "Real Gone", self.SOUNDTRACK)
        self.assertLess(album, compilation)

    def test_a_junk_hint_changes_nothing(self):
        from enrich import candidate_sort_key

        # Both sides reduce to noise: every candidate is neutral, the release
        # rank decides — the pre-hint behavior, exactly.
        album = candidate_sort_key("(Official Video) [HD]", "Live Edit", self.STUDIO)
        soundtrack = candidate_sort_key("(Official Video) [HD]", "Remix", self.SOUNDTRACK)
        self.assertEqual(album[0], soundtrack[0])
        self.assertLess(album, soundtrack)

    def test_settles_early_only_when_the_video_vouches_for_it(self):
        from enrich import candidate_sort_key, is_settled

        hint = "Real Gone"
        vouched = candidate_sort_key(hint, "Real Gone", self.STUDIO)
        contradicted = candidate_sort_key(hint, "Sleepin' on the Foldout", self.STUDIO)
        self.assertTrue(is_settled(vouched, hint))
        # A perfect release whose title the video denies must not end the scan:
        # the right song may still be a later candidate.
        self.assertFalse(is_settled(contradicted, hint))

    def test_settles_on_rank_alone_when_the_hint_is_junk(self):
        from enrich import candidate_sort_key, is_settled

        hint = "(Official Video) [HD]"
        key = candidate_sort_key(hint, "Some Song", self.STUDIO)
        self.assertTrue(is_settled(key, hint))


class CollectionGuardTest(unittest.TestCase):
    """A track filed in a collection must be refused by the per-track chain:
    a match would re-file it onto its release's album row (`_album_row_for`),
    ripping it out of the record its owner placed it in."""

    def test_refuses_a_track_sitting_on_a_collection(self):
        import os
        import shutil
        import tempfile

        from beets.library import Item, Library

        import enrich
        import library

        root = tempfile.mkdtemp()
        try:
            path = os.path.join(root, "Mine", "1 Kept.mp3")
            os.makedirs(os.path.dirname(path))
            with open(path, "wb") as fh:
                fh.write(b"audio")
            lib = Library(os.path.join(root, "library.db"), directory=root)
            album = lib.add_album([Item(path=path.encode(), title="Kept", album="Mine")])
            album[library.ALBUM_KIND_KEY] = library.COLLECTION
            album.store(inherit=False)
            item_id = next(iter(album.items())).id
            lib._close()

            with self.assertRaises(RuntimeError):
                enrich.handle(
                    "req",
                    {
                        "beets_db": os.path.join(root, "library.db"),
                        "library_dir": root,
                        "item_id": item_id,
                    },
                )
        finally:
            shutil.rmtree(root, ignore_errors=True)


class LibraryHarness(unittest.TestCase):
    """Against a real beets library, like move_tracks_test: what these paths
    promise is what beets does with rows and destinations."""

    def setUp(self):
        import os
        import tempfile

        self.dir = tempfile.mkdtemp()
        self.db = os.path.join(self.dir, "library.db")

    def tearDown(self):
        import shutil

        shutil.rmtree(self.dir, ignore_errors=True)

    def _item(self, name: str, **fields):
        import os

        from beets.library import Item

        path = os.path.join(self.dir, name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(b"audio")
        return Item(path=path.encode(), format="MP3", **fields)

    def _lib(self):
        from beets.library import Library

        return Library(self.db, directory=self.dir)


class FindNamedRowTest(LibraryHarness):
    def test_finds_the_row_wearing_the_name(self):
        import enrich

        lib = self._lib()
        row = lib.add_album(
            [self._item("AI/1 Holiday.mp3", title="Holiday", album="American Idiot", albumartist="Green Day")]
        )
        found = enrich.find_named_row(lib, "Green Day", "American Idiot")
        self.assertIsNotNone(found)
        self.assertEqual(found.id, row.id)
        self.assertIsNone(enrich.find_named_row(lib, "Green Day", "Dookie"))
        lib._close()

    def test_a_collection_is_never_a_landing_spot(self):
        import enrich
        import library

        lib = self._lib()
        row = lib.add_album(
            [self._item("AI/1 Holiday.mp3", title="Holiday", album="American Idiot", albumartist="Green Day")]
        )
        row[library.ALBUM_KIND_KEY] = library.COLLECTION
        row.store(inherit=False)
        self.assertIsNone(enrich.find_named_row(lib, "Green Day", "American Idiot"))
        lib._close()

    def test_blank_names_match_nothing(self):
        import enrich

        lib = self._lib()
        lib.add_album([self._item("blank/1 X.mp3", title="X", albumartist="LIVinglife")])
        self.assertIsNone(enrich.find_named_row(lib, "LIVinglife", ""))
        self.assertIsNone(enrich.find_named_row(lib, "", "American Idiot"))
        lib._close()

    def test_the_fullest_row_wins_when_the_pathology_exists(self):
        import enrich

        lib = self._lib()
        lib.add_album(
            [self._item("AI dup/1 Letterbomb.mp3", title="Letterbomb", album="American Idiot", albumartist="Green Day")]
        )
        full = lib.add_album(
            [
                self._item(f"AI/{n} T{n}.mp3", title=f"T{n}", album="American Idiot", albumartist="Green Day")
                for n in (1, 2)
            ]
        )
        self.assertEqual(enrich.find_named_row(lib, "Green Day", "American Idiot").id, full.id)
        lib._close()


class ProvisionalFilingTest(LibraryHarness):
    """The `LIVinglife/[86]/` regression: a guessed single used to stand up a
    blank album row, and %aunique could only name the blanks by row id."""

    def test_a_rootless_guess_files_as_a_singleton_not_a_blank_record(self):
        import enrich

        lib = self._lib()
        item = self._item("staging/video.mp3")
        lib.add(item)
        wrote = enrich.apply_provisional(
            lib, item, {"title": "Mamma Mia - I Do", "artist": "LIVinglife"}
        )
        self.assertTrue(wrote)
        fresh = lib.get_item(item.id)
        self.assertIsNone(fresh.album_id)
        self.assertEqual(len(list(lib.albums())), 0)
        # beets' `singleton` path applies (the guessed zone in the app config).
        self.assertIn("Non-Album", fresh.path.decode())
        lib._close()

    def test_a_blank_row_a_prior_run_left_dies_with_the_refile(self):
        import enrich

        lib = self._lib()
        item = self._item("LIVinglife/_/track.mp3", artist="LIVinglife")
        row = lib.add_album([item])
        self.assertEqual((row.album or ""), "")
        wrote = enrich.apply_provisional(
            lib, item, {"title": "Mamma Mia - I Do", "artist": "LIVinglife"}
        )
        self.assertTrue(wrote)
        self.assertIsNone(lib.get_album(row.id))
        self.assertIsNone(lib.get_item(item.id).album_id)
        lib._close()

    def test_a_guess_on_a_named_record_stays_with_it(self):
        import enrich

        lib = self._lib()
        item = self._item("AI/1 Unknown.mp3", album="American Idiot", albumartist="Green Day")
        row = lib.add_album([item])
        wrote = enrich.apply_provisional(lib, item, {"title": "Letterbomb", "artist": "LIVinglife"})
        self.assertTrue(wrote)
        fresh = lib.get_item(item.id)
        self.assertEqual(fresh.album_id, row.id)
        # The row's own words survive the guess.
        self.assertEqual(lib.get_album(row.id).album, "American Idiot")
        lib._close()
