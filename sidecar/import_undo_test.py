import os
import shutil
import tempfile
import unittest

from beets.importer.state import ImportState
from beets.library import Item, Library

import import_undo
from import_recap import BATCH_FIELD

BATCH = "run-1"


class UndoTest(unittest.TestCase):
    """Against a real beets library: the whole point of the module is what
    beets' own removal does around it — the album row, the cover, the pruning —
    and a hand-built SQLite file would prove none of it."""

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

    def _item(self, name: str, *, marked: bool = True, **fields) -> Item:
        item = Item(path=self._file(name), **fields)
        if marked:
            item[BATCH_FIELD] = BATCH
        return item

    def _params(self) -> dict:
        return {"beets_db": self.db, "library_dir": self.dir, "import_id": BATCH}

    def test_removes_the_runs_tracks_and_their_files(self):
        lib = Library(self.db, directory=self.dir)
        lib.add_album([self._item(f"Pile/{n}.mp3", title=f"t{n}") for n in (1, 2)])
        lib._close()

        result = import_undo.handle("req", self._params())

        self.assertEqual(result["removed"], 2)
        self.assertEqual(result["foreign"], 0)
        lib = Library(self.db, directory=self.dir)
        self.assertEqual(len(list(lib.items())), 0)
        # The album goes with its last track, and the emptied folder is pruned.
        self.assertEqual(len(list(lib.albums())), 0)
        lib._close()
        self.assertFalse(os.path.exists(os.path.join(self.dir, "Pile")))

    def test_an_album_the_run_only_added_to_survives(self):
        lib = Library(self.db, directory=self.dir)
        lib.add_album(
            [
                self._item("Kid A/1.mp3", title="Everything", album="Kid A"),
                self._item("Kid A/2.mp3", title="Kid A", album="Kid A", marked=False),
            ]
        )
        lib._close()

        preview = import_undo.preview("req", self._params())
        self.assertEqual(preview["tracks"], 1)
        self.assertEqual(preview["albumsRemoved"], 0)
        self.assertEqual(preview["albumsKept"], 1)

        import_undo.handle("req", self._params())

        lib = Library(self.db, directory=self.dir)
        self.assertEqual([item.title for item in lib.items()], ["Kid A"])
        self.assertEqual(len(list(lib.albums())), 1)
        lib._close()
        self.assertTrue(os.path.exists(os.path.join(self.dir, "Kid A", "2.mp3")))

    def test_another_runs_tracks_are_left_alone(self):
        lib = Library(self.db, directory=self.dir)
        mine = self._item("Mine/1.mp3", title="mine")
        theirs = self._item("Theirs/1.mp3", title="theirs", marked=False)
        theirs[BATCH_FIELD] = "run-2"
        lib.add_album([mine])
        lib.add_album([theirs])
        lib._close()

        import_undo.handle("req", self._params())

        lib = Library(self.db, directory=self.dir)
        self.assertEqual([item.title for item in lib.items()], ["theirs"])
        lib._close()

    def test_a_file_outside_the_library_keeps_its_file(self):
        outside = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, outside, True)
        path = os.path.join(outside, "stranger.mp3")
        with open(path, "wb") as fh:
            fh.write(b"audio")

        lib = Library(self.db, directory=self.dir)
        item = Item(path=path.encode(), title="stranger")
        item[BATCH_FIELD] = BATCH
        lib.add(item)
        lib._close()

        result = import_undo.handle("req", self._params())

        self.assertEqual(result["foreign"], 1)
        self.assertTrue(os.path.exists(path))
        lib = Library(self.db, directory=self.dir)
        self.assertEqual(len(list(lib.items())), 0)
        lib._close()

    def test_a_staged_singleton_cover_goes_too(self):
        art = self._file("Loose/1.jpg").decode()
        lib = Library(self.db, directory=self.dir)
        item = self._item("Loose/1.mp3", title="loose")
        item["sonarche_item_art"] = art
        lib.add(item)
        lib._close()

        import_undo.handle("req", self._params())

        self.assertFalse(os.path.exists(art))


class ForgetFolderTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.state = os.path.join(self.dir, "import-state.pickle")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def _write(self, history: list[tuple[bytes, ...]], progress: dict) -> None:
        state = ImportState(path=os.fsencode(self.state))
        state.taghistory = set(history)
        state.tagprogress = progress
        with state:
            pass

    def _read(self) -> ImportState:
        return ImportState(path=os.fsencode(self.state))

    def test_forgets_the_folder_and_keeps_the_others(self):
        mine = os.path.join(self.dir, "Music")
        other = os.path.join(self.dir, "Other")
        self._write(
            [(os.fsencode(os.path.join(mine, "Album")),), (os.fsencode(os.path.join(other, "Album")),)],
            {os.fsencode(mine): [b"x"], os.fsencode(other): [b"y"]},
        )

        dropped = import_undo.forget_folder(self.state, mine)

        self.assertEqual(dropped, 2)
        state = self._read()
        self.assertEqual(state.taghistory, {(os.fsencode(os.path.join(other, "Album")),)})
        self.assertEqual(list(state.tagprogress), [os.fsencode(other)])

    def test_no_state_file_is_not_an_error(self):
        self.assertEqual(import_undo.forget_folder(os.path.join(self.dir, "nope"), self.dir), 0)
        self.assertEqual(import_undo.forget_folder(None, None), 0)


if __name__ == "__main__":
    unittest.main()
