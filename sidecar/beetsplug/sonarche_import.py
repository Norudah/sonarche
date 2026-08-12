"""What a rip's filename knows that its tags do not.

Loaded only by the *import* flavour of the beets config — `pluginpath` points
at the sidecar and this plugin is named in that file's `plugins:` line; the
download path never sees it. It runs at `import_task_start`, before beets
applies the as-is data, so what it fills here is what lands in the library
and in the copied file's own tags.

It exists because beets' bundled `fromfilename` fails our import twice over.
It reasons over a whole task and gives up the moment artists *and* titles both
vary across it — which is exactly the shape of a folder of one-shot rips:
every file `Artist - Title.mp3` by a different artist, every title tag blank.
And it listens on `import_task_start`, which is only ever fired by the
MusicBrainz lookup stage — a stage `-A` skips, so on an as-is import it would
never run at all. This plugin reasons per file, only ever writes a field that
is empty, and listens on `import_task_created`: fired for every import
flavour, before the items are added to the database and before the files are
copied, so the *source* filename is still there to read and the fields it
fills shape the copy's destination path. Measured on a real user's folder: 14
files, 10 without a title tag, stock fromfilename recovers none.

The packed-year repair lives here too: yt-dlp writes release dates as
YYYYMMDD, mediafile cannot split that, and the whole number lands in `year` —
`Année 20240927` on screen, and a field that poses as filled in every recap.
"""

import os
import re

from beets import plugins
from beets.util import displayable_path

# `NN - Title` is tried first: on an album rip a leading number is a track,
# not an artist called "01".
_TRACK_TITLE = re.compile(r"^(?P<track>\d{1,3})[\s._-]+(?P<title>.+)$")
# Spaced hyphen only, so `AC-DC` or `Jay-Z` never splits. An unspaced name
# falls through and the whole stem becomes the title — a conservative miss,
# never a wrong artist.
_ARTIST_TITLE = re.compile(r"^(?P<artist>.+?)\s+-\s+(?P<title>.+)$")


def parse_stem(stem: str) -> tuple[str | None, int | None, str | None]:
    """(artist, track, title) as the filename states them, absences as None.
    Pure. A stem that matches no pattern is itself the title — a filename is
    always a better name than an empty field."""
    stem = stem.strip()
    if not stem:
        return None, None, None
    match = _TRACK_TITLE.match(stem)
    if match:
        return None, int(match.group("track")), match.group("title").strip()
    match = _ARTIST_TITLE.match(stem)
    if match:
        return match.group("artist").strip(), None, match.group("title").strip()
    return None, None, stem


def unpack_year(year) -> tuple[int, int, int] | None:
    """(year, month, day) out of a packed-date `year`, or None when the value
    is an ordinary year (or too broken to read). Pure.

    `20240927` → (2024, 9, 27). A packed value whose month/day part does not
    parse as a date still yields its year — the year is the part every view
    and every recap reads."""
    if not year or year <= 9999:
        return None
    digits = str(year)
    head = int(digits[:4])
    # An upper bound well past today, well short of nonsense: `99999999` must
    # not become the year 9999.
    if not 1000 <= head <= 2999:
        return None
    if len(digits) == 8:
        month, day = int(digits[4:6]), int(digits[6:8])
        if 1 <= month <= 12 and 1 <= day <= 31:
            return head, month, day
    return head, 0, 0


class SonarcheImportPlugin(plugins.BeetsPlugin):
    def __init__(self):
        super().__init__()
        self.register_listener("import_task_created", self.repair_task)

    def repair_task(self, task, session):
        # Sentinel and archive tasks carry no items; `getattr` keeps them from
        # crashing the walk. Returning None (implicitly) matters: a non-None
        # return from this event *replaces* the task list.
        #
        # `item` and not only `items`: a singleton import (`-s`, the grouping
        # mode for a folder of one-shots) builds `SingletonImportTask`, which
        # carries one `item` and no `items` at all — reading only the plural
        # left exactly the libraries this plugin exists for unrepaired.
        for item in getattr(task, "items", None) or []:
            self.repair(item)
        single = getattr(task, "item", None)
        if single is not None:
            self.repair(single)

    def repair(self, item):
        # The filename is only consulted when the title tag is empty: a file
        # that names itself is trusted over a pattern guess, however dirty
        # (`… (Official Lyric Video)` is the alignment's problem, not ours).
        if not item.title:
            stem = os.path.splitext(os.path.basename(displayable_path(item.path)))[0]
            artist, track, title = parse_stem(stem)
            if title:
                item.title = title
                self._log.info("title from filename: {0}", title)
            if artist and not item.artist:
                item.artist = artist
                self._log.info("artist from filename: {0}", artist)
            if track and not item.track:
                item.track = track
        unpacked = unpack_year(item.year)
        if unpacked is not None:
            item.year, item.month, item.day = unpacked
            self._log.info("packed date split into year {0}", item.year)
