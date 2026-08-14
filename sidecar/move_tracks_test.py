import os
import shutil
import tempfile
import unittest

from beets.library import Item, Library

import library
import move_tracks
import provenance
from move_tracks import renumbering


class RenumberingTest(unittest.TestCase):
    def test_stacks_after_the_existing_max(self):
        self.assertEqual(renumbering([1, 2, 3], 2), [4, 5])

    def test_gaps_are_not_refilled(self):
        # 2 is missing, but slipping a new track into it would interleave the
        # arrival into an order someone chose.
        self.assertEqual(renumbering([1, 3, 7], 2), [8, 9])

    def test_empty_record_starts_at_one(self):
        self.assertEqual(renumbering([], 3), [1, 2, 3])

    def test_unnumbered_residents_do_not_block_one(self):
        self.assertEqual(renumbering([0, 0], 2), [1, 2])


class MoveTest(unittest.TestCase):
    """Against a real beets library: the verb's whole job is what beets does
    around a re-parented item — the destination, the pruning, the album row's
    inheritance — and a hand-built SQLite file would prove none of it."""

    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.db = os.path.join(self.dir, "library.db")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def _file(self, name: str) -> bytes:
        path = os.path.join(self.dir, name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(b"audio")
        return path.encode()

    def _item(self, name: str, **fields) -> Item:
        return Item(path=self._file(name), format="MP3", **fields)

    def _lib(self) -> Library:
        return Library(self.db, directory=self.dir)

    def _album(self, lib, folder: str, titles: list[str], **fields):
        items = [
            self._item(
                f"{folder}/{n} {title}.mp3",
                title=title,
                track=n,
                tracktotal=len(titles),
                **fields,
            )
            for n, title in enumerate(titles, start=1)
        ]
        return lib.add_album(items)

    def _params(self, **extra) -> dict:
        return {"beets_db": self.db, "library_dir": self.dir, **extra}

    def _move(self, **extra) -> dict:
        return move_tracks.handle("req", self._params(**extra))

    # Moving into an existing record.

    def test_moves_a_track_into_an_existing_album(self):
        lib = self._lib()
        target = self._album(lib, "Mine", ["Kept"], album="Mine", albumartist="Muse")
        source = self._album(lib, "Kid A", ["Idioteque"], album="Kid A", albumartist="Radiohead", artist="Radiohead")
        moved_id = next(iter(source.items())).id
        lib._close()

        result = self._move(item_ids=[moved_id], target_album_id=target.id)

        self.assertEqual(result["moved"], 1)
        self.assertFalse(result["created"])
        lib = self._lib()
        item = lib.get_item(moved_id)
        self.assertEqual(item.album_id, target.id)
        self.assertEqual(item.album, "Mine")
        self.assertEqual(item.albumartist, "Muse")
        # A fact about the recording, not about its filing.
        self.assertEqual(item.artist, "Radiohead")
        # The file followed the record: filing is what the verb *is*.
        self.assertIn(os.path.join("Muse", "Mine"), item.path.decode())
        self.assertTrue(os.path.exists(item.path.decode()))
        lib._close()

    def test_tracks_already_on_the_target_are_skipped(self):
        lib = self._lib()
        target = self._album(lib, "Mine", ["Kept"], album="Mine", albumartist="Muse")
        resident_id = next(iter(target.items())).id
        lib._close()

        result = self._move(item_ids=[resident_id], target_album_id=target.id)

        self.assertEqual(result["moved"], 0)
        self.assertEqual(result["skipped"], 1)

    def test_missing_target_is_an_error(self):
        lib = self._lib()
        source = self._album(lib, "Kid A", ["Idioteque"], album="Kid A", albumartist="Radiohead")
        moved_id = next(iter(source.items())).id
        lib._close()

        with self.assertRaises(RuntimeError):
            self._move(item_ids=[moved_id], target_album_id=9999)

    # Renumbering.

    def test_renumber_stacks_after_the_targets_own_numbers(self):
        lib = self._lib()
        target = self._album(lib, "Mine", ["One", "Two"], album="Mine", albumartist="Muse")
        source = self._album(lib, "Kid A", ["A", "B"], album="Kid A", albumartist="Radiohead")
        moved = [item.id for item in sorted(source.items(), key=lambda i: i.track)]
        lib._close()

        self._move(item_ids=moved, target_album_id=target.id, renumber=True)

        lib = self._lib()
        self.assertEqual([lib.get_item(i).track for i in moved], [3, 4])
        # The record it was a position on no longer exists for this track.
        self.assertEqual([lib.get_item(i).tracktotal for i in moved], [0, 0])
        lib._close()

    def test_renumber_follows_the_request_order(self):
        lib = self._lib()
        target = self._album(lib, "Mine", ["One"], album="Mine", albumartist="Muse")
        source = self._album(lib, "Kid A", ["A", "B"], album="Kid A", albumartist="Radiohead")
        by_track = sorted(source.items(), key=lambda i: i.track)
        lib._close()

        # Selection order, reversed on purpose: the order of `item_ids` is the
        # numbering, not the tracks' old positions.
        self._move(
            item_ids=[by_track[1].id, by_track[0].id],
            target_album_id=target.id,
            renumber=True,
        )

        lib = self._lib()
        self.assertEqual(lib.get_item(by_track[1].id).track, 2)
        self.assertEqual(lib.get_item(by_track[0].id).track, 3)
        lib._close()

    def test_without_renumber_positions_are_kept(self):
        lib = self._lib()
        target = self._album(lib, "Kid A", ["Everything"], album="Kid A", albumartist="Radiohead")
        source = self._album(lib, "Kid A frag", ["Idioteque"], album="Kid A", albumartist="Radiohead")
        item = next(iter(source.items()))
        item.track = 8
        item.tracktotal = 10
        item.store()
        lib._close()

        self._move(item_ids=[item.id], target_album_id=target.id)

        lib = self._lib()
        self.assertEqual(lib.get_item(item.id).track, 8)
        self.assertEqual(lib.get_item(item.id).tracktotal, 10)
        lib._close()

    # Creating a record from a selection.

    def test_gathers_a_selection_into_a_new_collection(self):
        lib = self._lib()
        a = self._album(lib, "Kid A", ["Idioteque"], album="Kid A", albumartist="Radiohead", mb_albumid="mb-kid-a")
        b = self._album(lib, "Four", ["Fireproof"], album="Four", albumartist="One Direction", mb_albumid="mb-four")
        ids = [next(iter(a.items())).id, next(iter(b.items())).id]
        lib._close()

        result = self._move(
            item_ids=ids,
            new_album={"album": "Mes préférés", "albumartist": "Moi"},
            kind="collection",
            renumber=True,
        )

        self.assertTrue(result["created"])
        self.assertEqual(result["moved"], 2)
        lib = self._lib()
        album = lib.get_album(result["target_album_id"])
        self.assertEqual(album.album, "Mes préférés")
        self.assertEqual(album.albumartist, "Moi")
        self.assertEqual(album.get(library.ALBUM_KIND_KEY), library.COLLECTION)
        # The row copied the first item's release identity; it must not keep it.
        self.assertEqual(album.mb_albumid, "")
        self.assertEqual([item.track for item in sorted(album.items(), key=lambda i: i.track)], [1, 2])
        lib._close()

    def test_a_new_album_needs_a_title_and_an_artist(self):
        lib = self._lib()
        source = self._album(lib, "Kid A", ["Idioteque"], album="Kid A", albumartist="Radiohead")
        moved_id = next(iter(source.items())).id
        lib._close()

        for spec in ({"album": "", "albumartist": "Moi"}, {"album": "Mes préférés", "albumartist": " "}):
            with self.assertRaises(RuntimeError):
                self._move(item_ids=[moved_id], new_album=spec)

    def test_blanking_the_rows_identity_spares_the_tracks_own(self):
        """`store(inherit=True)` would push the blanked ids onto the items —
        the exact clobber `inherit=False` exists to prevent."""
        lib = self._lib()
        source = self._album(
            lib, "Kid A", ["Idioteque"],
            album="Kid A", albumartist="Radiohead",
            mb_albumid="mb-kid-a", mb_trackid="mb-idioteque",
        )
        moved_id = next(iter(source.items())).id
        lib._close()

        self._move(item_ids=[moved_id], new_album={"album": "Mes préférés", "albumartist": "Moi"})

        lib = self._lib()
        item = lib.get_item(moved_id)
        self.assertEqual(item.mb_trackid, "mb-idioteque")
        self.assertEqual(item.mb_albumid, "mb-kid-a")
        lib._close()

    def test_a_compilation_track_stops_being_one(self):
        """Found on the real library: `comp` picks the path *template*, so a
        track arriving from a compilation kept filing itself under
        `Compilations/` while its twelve new siblings sat under the artist —
        one record, two folders, and only the disk knew."""
        lib = self._lib()
        target = self._album(lib, "Mine", ["Kept"], album="Mine", albumartist="Muse")
        source = self._album(lib, "JPOP", ["Guest"], album="JPOP", albumartist="Various Artists", comp=True)
        moved_id = next(iter(source.items())).id
        lib._close()

        self._move(item_ids=[moved_id], target_album_id=target.id)

        lib = self._lib()
        item = lib.get_item(moved_id)
        self.assertFalse(bool(item.comp))
        self.assertIn(os.path.join("Muse", "Mine"), item.path.decode())
        self.assertNotIn("Compilations", item.path.decode())
        lib._close()

    # What the move leaves behind.

    def test_an_emptied_source_dies_with_its_folder(self):
        lib = self._lib()
        target = self._album(lib, "Mine", ["Kept"], album="Mine", albumartist="Muse")
        source = self._album(lib, "Kid A", ["Idioteque"], album="Kid A", albumartist="Radiohead")
        # The two files beets' own pruning cannot see past.
        art = os.path.join(self.dir, "Kid A", "cover.jpg")
        with open(art, "wb") as fh:
            fh.write(b"art")
        with open(os.path.join(self.dir, "Kid A", "cover-hq.jpg"), "wb") as fh:
            fh.write(b"hq")
        source.artpath = art.encode()
        source.store(inherit=False)
        moved_id = next(iter(source.items())).id
        lib._close()

        result = self._move(item_ids=[moved_id], target_album_id=target.id)

        self.assertEqual(result["sources_removed"], 1)
        lib = self._lib()
        self.assertIsNone(lib.get_album(source.id))
        lib._close()
        self.assertFalse(os.path.exists(os.path.join(self.dir, "Kid A")))

    def test_gathering_a_whole_record_takes_its_row_and_folder_with_it(self):
        """Found on the real library: `add_album` re-parents its items inside
        its own transaction, so reading the source off the item afterwards read
        the *new* row — no source was ever recorded, and the emptied one and
        its cover outlived the move."""
        lib = self._lib()
        source = self._album(lib, "Kid A", ["Everything", "Idioteque"], album="Kid A", albumartist="Radiohead")
        art = os.path.join(self.dir, "Kid A", "cover.jpg")
        with open(art, "wb") as fh:
            fh.write(b"art")
        source.artpath = art.encode()
        source.store(inherit=False)
        ids = [item.id for item in sorted(source.items(), key=lambda i: i.track)]
        lib._close()

        result = self._move(
            item_ids=ids,
            new_album={"album": "Mes préférés", "albumartist": "Moi"},
            kind="collection",
            renumber=True,
        )

        self.assertEqual(result["sources_removed"], 1)
        lib = self._lib()
        self.assertIsNone(lib.get_album(source.id))
        lib._close()
        self.assertFalse(os.path.exists(os.path.join(self.dir, "Kid A")))

    def test_a_source_still_holding_tracks_is_left_alone(self):
        lib = self._lib()
        target = self._album(lib, "Mine", ["Kept"], album="Mine", albumartist="Muse")
        source = self._album(lib, "Kid A", ["Everything", "Idioteque"], album="Kid A", albumartist="Radiohead")
        moved_id = sorted(source.items(), key=lambda i: i.track)[0].id
        lib._close()

        result = self._move(item_ids=[moved_id], target_album_id=target.id)

        self.assertEqual(result["sources_removed"], 0)
        lib = self._lib()
        source_after = lib.get_album(source.id)
        self.assertIsNotNone(source_after)
        self.assertEqual(len(list(source_after.items())), 1)
        lib._close()

    def test_the_move_is_remembered_on_the_item(self):
        lib = self._lib()
        target = self._album(lib, "Mine", ["Kept"], album="Mine", albumartist="Muse")
        source = self._album(lib, "Kid A", ["Idioteque"], album="Kid A", albumartist="Radiohead")
        moved_id = next(iter(source.items())).id
        lib._close()

        self._move(item_ids=[moved_id], target_album_id=target.id)

        lib = self._lib()
        item = lib.get_item(moved_id)
        self.assertEqual(item.get(move_tracks.MOVED_FROM_KEY), "Kid A")
        # The destination is the user's word, protected like a typed-in edit.
        self.assertTrue(provenance.was_hand_edited(item, "album"))
        lib._close()

    def test_moving_between_same_named_records_bakes_no_aunique_suffix(self):
        """Found on a user's library: a one-by-one download matched another
        edition of the target ("American Idiot" [48777-2] vs [WBCD 2075]), and
        the move computed the destination while the emptied source row still
        existed — %aunique saw two records with one name and suffixed the
        target's folder. The source was removed right after, but nothing
        re-moved the file, so every add left the album folder split."""
        lib = self._lib()
        target = self._album(
            lib, "American Idiot", ["Holiday"],
            album="American Idiot", albumartist="Green Day",
            mb_albumid="mb-standard", catalognum="48777-2",
        )
        source = self._album(
            lib, "American Idiot dup", ["Letterbomb"],
            album="American Idiot", albumartist="Green Day",
            mb_albumid="mb-japan", catalognum="WBCD 2075",
        )
        moved_id = next(iter(source.items())).id
        lib._close()

        self._move(item_ids=[moved_id], target_album_id=target.id)

        lib = self._lib()
        for item in lib.get_album(target.id).items():
            self.assertIn(os.path.join("Green Day", "American Idiot"), item.path.decode())
            self.assertNotIn("[", item.path.decode())
        lib._close()

    def test_arriving_tracks_heal_the_targets_stale_folder(self):
        """Residents whose paths were baked with a suffix by an earlier
        incident follow the same move: once the duplicate rows are gone the
        album re-files itself under its clean name."""
        lib = self._lib()
        target = self._album(
            lib, "American Idiot [48777-2]", ["Holiday"],
            album="American Idiot", albumartist="Green Day",
        )
        source = self._album(
            lib, "Kid A", ["Idioteque"], album="Kid A", albumartist="Radiohead"
        )
        moved_id = next(iter(source.items())).id
        lib._close()

        self._move(item_ids=[moved_id], target_album_id=target.id)

        lib = self._lib()
        for item in lib.get_album(target.id).items():
            self.assertIn(os.path.join("Green Day", "American Idiot"), item.path.decode())
            self.assertNotIn("[48777-2]", item.path.decode())
        lib._close()
        self.assertFalse(os.path.exists(os.path.join(self.dir, "American Idiot [48777-2]")))

    def test_a_target_without_an_album_artist_gets_one_from_its_tracks(self):
        """The two-cards regression: a row named track by track in the drawer
        never gains an album artist, arrivals inherit the blank, and the app —
        which groups cards by (album artist, title) with a per-track artist
        fallback — shows the one record as two albums."""
        lib = self._lib()
        target = self._album(
            lib, "X", ["One", "Two"],
            album="X", artist="Real Name",
        )
        self.assertEqual(target.albumartist, "")
        source = self._album(lib, "staging", ["Three"], artist="LIVinglife")
        moved_id = next(iter(source.items())).id
        lib._close()

        self._move(item_ids=[moved_id], target_album_id=target.id)

        lib = self._lib()
        healed = lib.get_album(target.id)
        # Majority artist among residents + arrival: "Real Name" (2 vs 1).
        self.assertEqual(healed.albumartist, "Real Name")
        for item in healed.items():
            self.assertEqual(item.albumartist, "Real Name")
        lib._close()

    def test_a_target_with_an_owner_keeps_it(self):
        lib = self._lib()
        target = self._album(
            lib, "Mine", ["Kept"], album="Mine", albumartist="Muse", artist="Muse"
        )
        source = self._album(lib, "staging", ["Guest"], artist="LIVinglife")
        moved_id = next(iter(source.items())).id
        lib._close()

        self._move(item_ids=[moved_id], target_album_id=target.id)

        lib = self._lib()
        self.assertEqual(lib.get_album(target.id).albumartist, "Muse")
        lib._close()

    def test_a_singleton_brings_its_own_cover_along(self):
        lib = self._lib()
        target = self._album(lib, "Mine", ["Kept"], album="Mine", albumartist="Muse")
        single = self._item("Singles/Orphan/Loner.mp3", title="Loner", artist="Orphan")
        lib.add(single)
        art = os.path.join(self.dir, "Singles", "Orphan", "Loner.jpg")
        with open(art, "wb") as fh:
            fh.write(b"art")
        single[library.ITEM_ART_KEY] = art
        single.store()
        lib._close()

        self._move(item_ids=[single.id], target_album_id=target.id)

        lib = self._lib()
        item = lib.get_item(single.id)
        followed = item.get(library.ITEM_ART_KEY)
        self.assertEqual(os.path.dirname(followed), os.path.dirname(item.path.decode()))
        self.assertTrue(os.path.exists(followed))
        lib._close()
        self.assertFalse(os.path.exists(os.path.join(self.dir, "Singles", "Orphan")))

    # Declaring the target's nature in the same pass.

    def test_kind_album_clears_a_stale_collection_mark(self):
        lib = self._lib()
        target = self._album(lib, "Kid A", ["Everything"], album="Kid A", albumartist="Radiohead")
        target[library.ALBUM_KIND_KEY] = library.COLLECTION
        target.store(inherit=False)
        source = self._album(lib, "Kid A frag", ["Idioteque"], album="Kid A", albumartist="Radiohead")
        moved_id = next(iter(source.items())).id
        lib._close()

        self._move(item_ids=[moved_id], target_album_id=target.id, kind="album")

        lib = self._lib()
        self.assertIsNone(lib.get_album(target.id).get(library.ALBUM_KIND_KEY))
        lib._close()

    def test_unknown_kind_is_rejected(self):
        lib = self._lib()
        target = self._album(lib, "Mine", ["Kept"], album="Mine", albumartist="Muse")
        source = self._album(lib, "Kid A", ["Idioteque"], album="Kid A", albumartist="Radiohead")
        moved_id = next(iter(source.items())).id
        lib._close()

        with self.assertRaises(RuntimeError):
            self._move(item_ids=[moved_id], target_album_id=target.id, kind="playlist")

    def test_both_targets_at_once_is_an_error(self):
        with self.assertRaises(RuntimeError):
            self._move(item_ids=[1], target_album_id=1, new_album={"album": "X", "albumartist": "Y"})
        with self.assertRaises(RuntimeError):
            self._move(item_ids=[1])


if __name__ == "__main__":
    unittest.main()
