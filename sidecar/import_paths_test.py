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
    "%if{$albumartist,$albumartist,Unknown Artist}/"
    "%if{$album,$album,Unknown Album}/"
    "%if{$track,$track ,}$title"
)
SINGLETON = "Singles/%if{$artist,$artist,Unknown Artist}/$title"
COMP = "Compilations/%if{$album,$album,Unknown Album}/%if{$track,$track ,}$title"

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
            "Sigrid/Sucker Punch/03 Strangers",
        )

    def test_an_untagged_rip_gets_named_folders_instead_of_empty_ones(self):
        """The regression this template exists for: beets' stock one renders
        `//Title` here, and every untagged track in the library shares those two
        nameless folders."""
        self.assertEqual(render(DEFAULT, title="Airplane"), "Unknown Artist/Unknown Album/Airplane")

    def test_an_unnumbered_track_drops_the_prefix_rather_than_wearing_a_zero(self):
        """beets reads an unset track as falsy, so `%if` covers both "no tag"
        and "tagged 0" — which is what a yt-dlp rip carries."""
        self.assertEqual(render(DEFAULT, albumartist="Mili", album="Mili", title="Rosetta"), "Mili/Mili/Rosetta")
        self.assertEqual(render(DEFAULT, albumartist="Mili", album="Mili", track="00", title="Rosetta"), "Mili/Mili/Rosetta")

    def test_only_the_missing_half_falls_back(self):
        self.assertEqual(render(DEFAULT, albumartist="Sigrid", title="Fort Knox"), "Sigrid/Unknown Album/Fort Knox")


class OtherPathsTest(unittest.TestCase):
    def test_a_singleton_is_filed_by_artist_under_one_roof(self):
        self.assertEqual(render(SINGLETON, artist="Sigrid", title="Fort Knox"), "Singles/Sigrid/Fort Knox")
        self.assertEqual(render(SINGLETON, title="Fort Knox"), "Singles/Unknown Artist/Fort Knox")

    def test_a_compilation_keeps_its_own_shelf(self):
        self.assertEqual(render(COMP, album="OST", track="02", title="Java"), "Compilations/OST/02 Java")
        self.assertEqual(render(COMP, title="Java"), "Compilations/Unknown Album/Java")


if __name__ == "__main__":
    unittest.main()
