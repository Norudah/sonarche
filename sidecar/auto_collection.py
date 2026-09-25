"""Mark album rows the import made out of unrelated files as collections.

beets makes one album per directory, so a folder of one-shots becomes an
"album" with a gapped tracklist. Judged on the files' own album tags.
Only rows this run created and that have no kind yet are marked; nothing is
ever marked as an album. Reversible from the album page.
"""

from dataclasses import dataclass

import library
import protocol
from import_recap import BATCH_FIELD

# Too few tracks to judge.
MIN_TRACKS = 3


@dataclass(frozen=True)
class TrackFacts:
    """One track's own album tag (not the beets-derived row title)."""

    album: str
    artist: str
    track: int


def _normalized(value: str) -> str:
    return (value or "").strip().casefold()


def looks_like_collection(tracks: list[TrackFacts]) -> bool:
    """Whether these tracks disagree about being one release.

    - Two or more distinct album tags.
    - No album tag and either several artists or no track number at all.

    No album tag with one artist and numbered tracks abstains: it looks like a
    rip that lost its album tag.
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
    """Mark this run's heterogeneous rows as collections. Returns the count."""
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
            # Some tracks predate this run: not ours to relabel.
            if any(item.id not in item_ids for item in items):
                continue
            facts = [
                TrackFacts(album=item.album or "", artist=item.artist or "", track=item.track or 0)
                for item in items
            ]
            if not looks_like_collection(facts):
                continue
            album[library.ALBUM_KIND_KEY] = library.COLLECTION
            # App-only attribute, not written to tags.
            album.store()
            marked += 1
    finally:
        lib._close()

    if marked:
        protocol.log(f"import: {marked} row(s) filed as collections rather than albums")
    return marked
