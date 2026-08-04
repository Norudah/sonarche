"""One album, because the user said so.

A playlist of film, series or game music is a record in the user's head and
twelve unrelated releases in MusicBrainz. Enriched normally it lands as twelve
album rows in twelve folders — every track correctly identified, and the album
the user actually wanted nowhere on the shelf.

A forced album keeps the per-track identification (title, artist, genre and
year still come from MusicBrainz — the artist column is the whole point of
paying for that pass) and overrides only what says *where the track is filed*:
album, album artist, and the position in the record.

The track number is renumbered from the playlist order here, where
`provisional.py` refuses to guess it. The two are not in conflict: there, a
position is a guess about a real release whose real numbering exists and
matters; here the user has declared the playlist to *be* the record, so its
order is the numbering — there is no other truth to contradict.
"""

import re
import unicodedata

import enrich
import protocol

# The album the cover came from is a YouTube thumbnail, not real cover art:
# right shape, wrong picture, and the user is told to replace it. Carried on
# the items (not the album row) because that is the axis the library listing
# already reads flexible attributes on.
COVER_FLAG = "sonarche_provisional_cover"

# What a record of many artists is called when it has no single one. beets'
# own convention, and what the album panel offers to keep.
DEFAULT_ARTIST = "Various Artists"

# Words a soundtrack release-group adds around the media's own name. Stripped
# before comparing, so "Inception" matches "Inception: Music From the Motion
# Picture" without loosening the match into a substring free-for-all.
_SOUNDTRACK_NOISE = (
    "original motion picture soundtrack",
    "music from the motion picture",
    "original television soundtrack",
    "original video game soundtrack",
    "original game soundtrack",
    "motion picture soundtrack",
    "original soundtrack",
    "original score",
    "complete score",
    "soundtrack",
    "ost",
)

# Below this, a title is too generic for a text search to mean anything.
_MIN_TITLE_CHARS = 3


def requested(params: dict) -> dict | None:
    """The forced album this request asks for, normalized, or None.

    A blank title is "not forced" rather than an error: the toggle can be on
    with the field still empty, and a download must not fail over that."""
    spec = params.get("forced_album") or {}
    title = str(spec.get("title") or "").strip()
    if not title:
        return None
    return {
        "title": title,
        "artist": str(spec.get("artist") or "").strip() or DEFAULT_ARTIST,
        "category": str(spec.get("category") or "").strip(),
        "thumbnail": str(spec.get("thumbnail") or "").strip(),
    }


def is_media_category(category: str | None) -> bool:
    """Whether the category names a medium whose soundtrack MusicBrainz might
    carry. Defined by exclusion on purpose: the taxonomy lives in the frontend,
    and restating its values here would leave two lists to keep in step. Only
    plain music (and no category at all) has no medium to look up."""
    return bool(category) and category.strip() != "Music"


def normalize_title(text: str | None) -> str:
    """Casefolded, unaccented, punctuation-free form used for comparison only."""
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFKD", str(text))
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", stripped.casefold()).strip()


def strip_soundtrack_noise(text: str | None) -> str:
    """A release-group title reduced to the media's own name."""
    normalized = normalize_title(text)
    for noise in _SOUNDTRACK_NOISE:
        normalized = normalized.replace(noise, " ")
    # The separator left behind by "Inception: Music From…" once the tail goes.
    return re.sub(r"\s+", " ", normalized).strip()


def title_matches(candidate: str | None, wanted: str | None) -> bool:
    """Whether a release-group title names the media the user typed.

    Prefix-either-way rather than equality: the user types "Inception", the
    release-group is "Inception (Original Motion Picture Soundtrack)", and both
    reduce to the same head. A bare substring test would hand "Her" every
    release whose title contains it, so the match has to start at the front."""
    left, right = strip_soundtrack_noise(candidate), strip_soundtrack_noise(wanted)
    if len(right) < _MIN_TITLE_CHARS or not left:
        return False
    return left == right or left.startswith(f"{right} ") or right.startswith(f"{left} ")


def numbering(item_ids: list[int]) -> dict[int, int]:
    """Playlist order to track numbers, 1..N. Pure."""
    return {item_id: index for index, item_id in enumerate(item_ids, start=1)}


def _release_group_id(title: str) -> str | None:
    """A soundtrack release-group whose title names this media, or None."""
    import metadata

    plugin = metadata.mb_plugin()
    try:
        results = plugin.mb_api.search(
            "release-group",
            {"releasegroup": title, "secondarytype": "Soundtrack"},
            limit=5,
        )
    except Exception as exc:
        protocol.log(f"forced_album: release-group search failed: {exc}")
        return None
    for group in results:
        if title_matches(group.get("title"), title):
            protocol.log(
                f"forced_album: « {group.get('title')} » matches « {title} » "
                f"(release-group {group.get('id')})"
            )
            return group.get("id")
    protocol.log(f"forced_album: no soundtrack release-group named « {title} »")
    return None


def media_cover(title: str) -> tuple[tuple[bytes, bool], tuple[bytes, bool]] | None:
    """The media's own artwork — the film poster, the game's key art — off the
    Cover Art Archive, via the soundtrack release the user never asked us to
    match. The tags stay per-track; only the picture is borrowed."""
    group_id = _release_group_id(title)
    if not group_id:
        return None
    return enrich._caa_front(f"release-group/{group_id}")


def thumbnail_cover(url: str) -> tuple[tuple[bytes, bool], tuple[bytes, bool]] | None:
    """The video's thumbnail, as a stand-in cover. Same picture twice: there is
    no high-quality edition of a thumbnail to archive."""
    if not url:
        return None
    import requests

    try:
        response = requests.get(url, timeout=30)
    except Exception as exc:
        protocol.log(f"forced_album: thumbnail fetch failed: {exc}")
        return None
    if response.status_code != 200 or not response.content:
        protocol.log(f"forced_album: thumbnail unavailable ({response.status_code})")
        return None
    cover = (response.content, response.content[:4] == b"\x89PNG")
    return cover, cover


def apply(lib, items, spec: dict):
    """File every item under the one album the user named, and return its row.

    The items arrive already enriched and already filed — each under the row of
    the release it happened to match. Moving them means rewriting the filing
    tags, standing up one row, and *dropping the rows they left*: beets suffixes
    a folder with %aunique for every sibling row sharing its name, so a leftover
    empty row is the difference between "Inception" and "Inception [2]"."""
    numbers = numbering([item.id for item in items])
    left_behind = {item.album_id for item in items if item.album_id is not None}

    for item in items:
        item.album = spec["title"]
        item.albumartist = spec["artist"]
        item.track = numbers[item.id]
        item.tracktotal = len(items)
        # `comp` is deliberately left alone. It reads as the right flag for a
        # many-artist record, but beets' default paths route a compilation to
        # Compilations/$album — which throws away the album artist the user just
        # typed, and files this one record differently from every other album in
        # the library. The filing rule here stays $albumartist/$album.
        #
        # The release it came from is no longer where it lives. `mb_trackid`
        # stays — the recording identity is still true, and it is what a later
        # re-match reads.
        item.mb_albumid = ""
        item.mb_releasegroupid = ""
        item.store()

    album = lib.add_album(items)
    album.album = spec["title"]
    album.albumartist = spec["artist"]
    album.mb_albumid = ""
    album.mb_releasegroupid = ""
    album.store()

    for row_id in left_behind - {album.id}:
        row = lib.get_album(row_id)
        if row is None or list(row.items()):
            continue
        protocol.log(f"forced_album: dropping emptied album row {row_id}")
        row.remove(delete=False, with_items=False)

    album.try_sync(write=True, move=True)
    protocol.log(
        f"forced_album: « {spec['title']} » by {spec['artist']} "
        f"holds {len(items)} track(s)"
    )
    return album


def ensure_cover(lib, album, items, spec: dict) -> bool:
    """Give the forced album a cover. Returns True when it is the provisional
    one, so the caller can say so.

    The media's own artwork first — for a film or a game that is the picture
    the user pictured. The thumbnail only when that fails, flagged, because a
    video frame on an album shelf is a placeholder, not a cover."""
    cover, provisional = None, False
    if is_media_category(spec["category"]):
        cover = media_cover(spec["title"])
    if cover is None:
        cover = thumbnail_cover(spec["thumbnail"])
        provisional = cover is not None
    if cover is None:
        protocol.log("forced_album: no cover found, album left bare")
        return False

    hq, thumb = cover
    # Written onto the album row and shown in the metadata panel, so it names
    # the *kind* of picture rather than the site it came from.
    source = "Video thumbnail" if provisional else "Cover Art Archive"
    try:
        enrich.set_album_art(album, *thumb, source=source)
        enrich.save_hq_cover(album, *hq)
        for item in items:
            enrich.embed_cover(item, *thumb)
    except Exception as exc:  # the album landed; a cover is not worth failing on
        protocol.log(f"forced_album: cover store failed: {exc}")
        return False

    for item in items:
        fresh = lib.get_item(item.id)
        if fresh is None:
            continue
        if provisional:
            fresh[COVER_FLAG] = 1
        elif fresh.get(COVER_FLAG):
            del fresh[COVER_FLAG]
        fresh.store()
    protocol.log(f"forced_album: cover stored from {source}")
    return provisional
