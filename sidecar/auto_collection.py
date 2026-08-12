"""Records the import made up, said so at the moment it makes them.

`album_kind.py` lets someone declare after the fact that a record is a
collection rather than a release. This is the same statement, made by the
import, for the rows nobody chose: beets files one album per *directory*, so a
folder of forty one-shots becomes a single album row — and the metadata page
then asks that row for its missing track 7, every time it is opened, forever.

The judgement is made on what the *files* say, not on the row beets built out
of them. A release states itself: its tracks carry the same album tag. So a row
whose tracks never claimed to be one record, or claimed to be two, is not a
release — it is a folder, and the import says so instead of leaving the
question open.

Deliberately narrow:

- Only rows this run *created*. An import merging tracks into an album that was
  already on the shelf must not relabel it; that album's kind is its owner's
  business and may already have been answered.
- Only rows with no kind yet, so a re-import can never overturn an answer.
- Never the other way round. Nothing here ever marks a row as an album — the
  absence of the attribute already means that, and a guess that *adds* a
  tracklist check is a guess that nags.

Reversible in one click on the album page, like any other kind.
"""

from dataclasses import dataclass

import library
import protocol
from import_recap import BATCH_FIELD

# Below this, there is nothing to disagree about. One or two files in a folder
# say nothing about whether that folder is a record, and calling such a row a
# collection would only trade one guess for another.
MIN_TRACKS = 3


@dataclass(frozen=True)
class TrackFacts:
    """What one track says about the record it belongs to.

    The album tag as the *file* carries it — not the album row's title, which
    beets derived and which therefore cannot testify about its own origin.
    """

    album: str
    artist: str
    track: int


def _normalized(value: str) -> str:
    return (value or "").strip().casefold()


def looks_like_collection(tracks: list[TrackFacts]) -> bool:
    """Whether these tracks disagree about being one release. Pure.

    Two ways of disagreeing, and one deliberate abstention:

    - Two or more distinct album tags: the folder held several records. beets
      merged them because they shared a directory, and the tags say otherwise.
    - No album tag anywhere *and* either several artists or not a single track
      number: nothing here ever claimed to be a release, and nothing gives it
      the shape of one.

    A folder with no album tag but one artist and numbered tracks abstains: it
    has the shape of a rip whose album tag was lost, and treating that as a
    collection would silence a check that is about to be useful.
    """
    if len(tracks) < MIN_TRACKS:
        return False

    albums = {_normalized(track.album) for track in tracks if _normalized(track.album)}
    if len(albums) > 1:
        return True
    if albums:
        return False

    artists = {_normalized(track.artist) for track in tracks if _normalized(track.artist)}
    return len(artists) > 1 or not any(track.track for track in tracks)


def mark(db_path: str, library_dir: str, batch: str) -> int:
    """Set the collection kind on the run's own heterogeneous rows.

    Returns how many were marked, which is what the recap reports: the import
    changed the reading of those records and must say so rather than let the
    user find out from a check that stopped firing.
    """
    from beets.library import Library

    lib = Library(db_path, directory=library_dir)
    marked = 0
    try:
        mine: dict[int, set[int]] = {}
        for item in lib.items(f"{BATCH_FIELD}:{batch}"):
            if item.album_id:
                mine.setdefault(item.album_id, set()).add(item.id)

        for album_id, item_ids in sorted(mine.items()):
            album = lib.get_album(album_id)
            if album is None or album.get(library.ALBUM_KIND_KEY):
                continue
            items = list(album.items())
            # An album the run merged into: some of its tracks were here
            # before, so the row is not this import's to name.
            if any(item.id not in item_ids for item in items):
                continue
            facts = [
                TrackFacts(album=item.album or "", artist=item.artist or "", track=item.track or 0)
                for item in items
            ]
            if not looks_like_collection(facts):
                continue
            album[library.ALBUM_KIND_KEY] = library.COLLECTION
            # `store()` only: the kind is Sonarche's reading of the record and
            # no tag any other player could carry. Same rule as `album_kind`.
            album.store()
            marked += 1
    finally:
        lib._close()

    if marked:
        protocol.log(f"import: {marked} row(s) filed as collections rather than albums")
    return marked
