"""Where an imported track lands, checked against beets' own renderer.

The templates live in `python_env.rs`, which writes the import config — but Rust
cannot run beets, and the only thing worth asserting about a path template is
what beets makes of it. So they are copied here and rendered for real. The two
copies must agree; that is the whole point of the file, and the reason each
constant names its source.

What is being pinned down is the *empty* case. beets' stock
`$albumartist/$album/$track $title` renders an untagged rip as `//00 Title` —
two empty path components, which is how a library ends up filing everything
under `Music//` with `0.mp3`, `0.1.mp3`, `0.2.mp3` beside each other.
"""

import unittest

from beets.library.models import DefaultTemplateFunctions
from beets.util.functemplate import Template

# Copied from `IMPORT_PATHS` in src-tauri/src/python_env.rs.
DEFAULT = (
    "Library/%if{$albumartist,$albumartist,Unknown Artist}/"
    "%if{$album,$album,Unknown Album}/"
    "%if{$track,$track ,}$title"
)
SINGLETON = "%ifdef{sonarche_provisional,Unidentified,Library/Singles}/%if{$artist,$artist,Unknown Artist}/$title"
# `comp` restates `default`, and must keep doing so — see the note on
# `APP_PATHS`. Spelled out rather than omitted: beets merges our config over its
# own defaults key by key, so a missing `comp` is beets' `Compilations/$album`,
# not "no compilation rule".
COMP = DEFAULT

# Copied from `APP_PATHS` in src-tauri/src/python_env.rs.
APP_DEFAULT = (
    "Library/%if{$albumartist,$albumartist,Unknown Artist}/"
    "%if{$album,$album,Unknown Album}%aunique{}/"
    "%if{$track,$track ,}$title"
)
APP_SINGLETON = "%ifdef{sonarche_provisional,Unidentified,Library/Singles}/%if{$artist,$artist,Unknown Artist}/$title"
APP_COMP = APP_DEFAULT

_FUNCTIONS = DefaultTemplateFunctions().functions()


def render(template: str, **values) -> str:
    fields = {
        "albumartist": "",
        "album": "",
        "artist": "",
        "track": "",
        "title": "",
        **values,
    }
    return Template(template).substitute(fields, _FUNCTIONS)


class DefaultPathTest(unittest.TestCase):
    def test_a_tagged_track_files_where_it_always_did(self):
        self.assertEqual(
            render(DEFAULT, albumartist="Sigrid", album="Sucker Punch", track="03", title="Strangers"),
            "Library/Sigrid/Sucker Punch/03 Strangers",
        )

    def test_an_untagged_rip_gets_named_folders_instead_of_empty_ones(self):
        """The regression this template exists for: beets' stock one renders
        `//Title` here, and every untagged track in the library shares those two
        nameless folders."""
        self.assertEqual(render(DEFAULT, title="Airplane"), "Library/Unknown Artist/Unknown Album/Airplane")

    def test_an_unnumbered_track_drops_the_prefix_rather_than_wearing_a_zero(self):
        """beets reads an unset track as falsy, so `%if` covers both "no tag"
        and "tagged 0" — which is what a yt-dlp rip carries."""
        self.assertEqual(render(DEFAULT, albumartist="Mili", album="Mili", title="Rosetta"), "Library/Mili/Mili/Rosetta")
        self.assertEqual(render(DEFAULT, albumartist="Mili", album="Mili", track="00", title="Rosetta"), "Library/Mili/Mili/Rosetta")

    def test_only_the_missing_half_falls_back(self):
        self.assertEqual(render(DEFAULT, albumartist="Sigrid", title="Fort Knox"), "Library/Sigrid/Unknown Album/Fort Knox")


class AppPathsTest(unittest.TestCase):
    """The app flavour: same guards, plus %aunique (which renders empty here —
    no library behind the template — exactly like a unique album), and the
    guessed zone for singletons — an item no album row claims is a provisional
    single, and it must not sit on the shelves as if it were verified."""

    def test_a_tagged_track_files_on_the_library_shelf(self):
        self.assertEqual(
            render(APP_DEFAULT, albumartist="Green Day", album="American Idiot", track="03", title="Holiday"),
            "Library/Green Day/American Idiot/03 Holiday",
        )

    def test_a_zero_track_drops_the_prefix_rather_than_wearing_00(self):
        # The `00 Mamma Mia - I Do.m4a` regression: provisional parks a 0.
        self.assertEqual(
            render(APP_DEFAULT, albumartist="Green Day", album="American Idiot", track="00", title="Holiday"),
            "Library/Green Day/American Idiot/Holiday",
        )

class CompilationShelfTest(unittest.TestCase):
    """A compilation files under its album artist like every other record.

    beets' stock `comp` template sends it to `Compilations/$album` instead: the
    album artist is thrown away, the record leaves the `Library/` zone, and the
    flag is carried per *item* — so one unidentified track keeping `comp` at 0
    split a soundtrack across two folders while the app showed it whole.

    Rendered against a real Library rather than the dict renderer above: which
    template beets *picks* is the thing under test, and only a library with a
    flagged album row makes that choice."""

    def test_a_compilation_files_under_its_album_artist(self):
        import os
        import shutil
        import tempfile

        import beets
        from beets.library import Item, Library

        root = tempfile.mkdtemp()
        old = {key: beets.config["paths"][key].get() for key in ("default", "comp")}
        beets.config["paths"]["default"] = APP_DEFAULT
        beets.config["paths"]["comp"] = APP_COMP
        try:
            lib = Library(os.path.join(root, "library.db"), directory=root)
            path = os.path.join(root, "x.m4a")
            with open(path, "wb") as fh:
                fh.write(b"audio")
            items = [
                Item(
                    path=path.encode(),
                    format="AAC",
                    title=title,
                    track=n,
                    album="High School Musical 2",
                    albumartist="Various Artists",
                    artist="Cast",
                    # The disagreement that used to split the folder: the
                    # identified sibling carries the flag, the guessed one does
                    # not, and both belong to the same record.
                    comp=(n == 1),
                )
                for n, title in enumerate(["What Time Is It", "All For One"], start=1)
            ]
            album = lib.add_album(items)
            album.comp = True
            album.store()
            for item in lib.get_album(album.id).items():
                destination = item.destination().decode()
                self.assertIn("Library/Various Artists/High School Musical 2/", destination)
                self.assertNotIn("Compilations", destination)
            lib._close()
        finally:
            for key, value in old.items():
                beets.config["paths"][key] = value
            shutil.rmtree(root, ignore_errors=True)


class SingletonZoneTest(unittest.TestCase):
    """The singleton template, against a real Library: `%ifdef` reads the
    provisional flag's *definedness* off the item itself, which the dict
    renderer above cannot say. Pinned here because `%if` was the trap — a
    missing flexible attribute renders as the literal `$symbol`, which `%if`
    reads as true, and every verified single would have landed in the zone."""

    def test_the_flag_and_only_the_flag_routes_to_the_zone(self):
        import os
        import shutil
        import tempfile

        import beets
        from beets.library import Item, Library

        root = tempfile.mkdtemp()
        old = beets.config["paths"]["singleton"].get()
        beets.config["paths"]["singleton"] = APP_SINGLETON
        try:
            lib = Library(os.path.join(root, "library.db"), directory=root)
            path = os.path.join(root, "x.mp3")
            with open(path, "wb") as fh:
                fh.write(b"audio")
            plain = Item(path=path.encode(), format="MP3", title="Fort Knox", artist="Sigrid")
            lib.add(plain)
            self.assertIn("Library/Singles/Sigrid", plain.destination().decode())

            flagged = Item(path=path.encode(), format="MP3", title="Mamma", artist="LIVinglife")
            lib.add(flagged)
            flagged["sonarche_provisional"] = 1
            flagged.store()
            self.assertIn("Unidentified/LIVinglife", lib.get_item(flagged.id).destination().decode())

            # A later real match deletes the flag: back on the shelf.
            fresh = lib.get_item(flagged.id)
            del fresh["sonarche_provisional"]
            fresh.store()
            self.assertIn("Library/Singles/LIVinglife", lib.get_item(flagged.id).destination().decode())
            lib._close()
        finally:
            beets.config["paths"]["singleton"] = old
            shutil.rmtree(root, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
