"""Import path templates, rendered by beets itself.

The templates are copied from `python_env.rs` (Rust can't run beets); both
copies must agree. The focus is untagged files: beets' stock template
renders them as `//00 Title`.
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
# Must stay equal to `default`: omitting it would fall back to beets'
# `Compilations/$album`.
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
        """beets' stock template renders `//Title` here."""
        self.assertEqual(render(DEFAULT, title="Airplane"), "Library/Unknown Artist/Unknown Album/Airplane")

    def test_an_unnumbered_track_drops_the_prefix_rather_than_wearing_a_zero(self):
        """beets reads an unset track as falsy, so `%if` covers both "no tag"
        and "tagged 0" — which is what a yt-dlp rip carries."""
        self.assertEqual(render(DEFAULT, albumartist="Mili", album="Mili", title="Rosetta"), "Library/Mili/Mili/Rosetta")
        self.assertEqual(render(DEFAULT, albumartist="Mili", album="Mili", track="00", title="Rosetta"), "Library/Mili/Mili/Rosetta")

    def test_only_the_missing_half_falls_back(self):
        self.assertEqual(render(DEFAULT, albumartist="Sigrid", title="Fort Knox"), "Library/Sigrid/Unknown Album/Fort Knox")


class AppPathsTest(unittest.TestCase):
    """App flavour: same guards plus %aunique (empty without a library), and
    singletons routed to the guessed zone."""

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
    """A compilation files under its album artist, not `Compilations/$album`.

    Rendered against a real Library, since which template beets picks is what
    is under test."""

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
                    # One sibling flagged, the other not: both belong to the same record.
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
    """`%ifdef` routes on the flag's presence. `%if` would read a missing
    attribute's literal `$symbol` as true."""

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
