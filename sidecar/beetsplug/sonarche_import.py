"""beets plugin for library imports: fill empty tags from the filename.

Loaded only by the import flavour of the beets config. Replaces the bundled
`fromfilename`, which reasons per task (and gives up on folders of rips by
different artists) and hooks a stage `-A` skips. This plugin works per file,
only fills empty fields, and listens on `import_task_created`, before files
are copied.

Also unpacks YYYYMMDD dates that yt-dlp writes into `year`.
"""

import os
import re

from beets import plugins
from beets.util import displayable_path

# Tried first: on album rips a leading number is a track, not an artist.
_TRACK_TITLE = re.compile(r"^(?P<track>\d{1,3})[\s._-]+(?P<title>.+)$")
# Spaced hyphen only, so `AC-DC` or `Jay-Z` never split.
_ARTIST_TITLE = re.compile(r"^(?P<artist>.+?)\s+-\s+(?P<title>.+)$")


def parse_stem(stem: str) -> tuple[str | None, int | None, str | None]:
    """(artist, track, title) from a filename stem, None when absent. An
    unmatched stem is the title."""
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
    """(year, month, day) from a packed `year` like 20240927, or None for an
    ordinary year. An invalid month/day still yields the year."""
    if not year or year <= 9999:
        return None
    digits = str(year)
    head = int(digits[:4])
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
        # Must return None: a return value replaces the task list. Singleton tasks
        # carry `item`, album tasks `items`, sentinel tasks neither.
        for item in getattr(task, "items", None) or []:
            self.repair(item)
        single = getattr(task, "item", None)
        if single is not None:
            self.repair(single)

    def repair(self, item):
        # An existing title tag is trusted over a filename guess.
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
