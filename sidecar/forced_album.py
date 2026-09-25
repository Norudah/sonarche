"""One album, because the user said so.

A soundtrack playlist maps to many unrelated MusicBrainz releases. A forced
album keeps per-track identification (title, artist, genre, year) and only
overrides filing: album, album artist and track number.

Unlike `provisional.py`, track numbers come from the playlist order: the user
declared the playlist to be the record.
"""

import re
import unicodedata

import enrich
import protocol

# The cover is a video thumbnail placeholder. On items, since the listing
# reads flexible attributes per item.
COVER_FLAG = "sonarche_provisional_cover"

DEFAULT_ARTIST = "Various Artists"

# Stripped before comparing, so "Inception" matches "Inception: Music From
# the Motion Picture".
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

_MIN_TITLE_CHARS = 3


def requested(params: dict) -> dict | None:
    """The requested forced album, normalized, or None (a blank title means
    not forced)."""
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
    """Whether the category is a medium that may have a soundtrack release.
    Defined by exclusion so the frontend's taxonomy isn't duplicated here."""
    return bool(category) and category.strip() != "Music"


def normalize_title(text: str | None) -> str:
    """Casefolded, unaccented, punctuation-free form, for comparison only."""
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFKD", str(text))
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", stripped.casefold()).strip()


def strip_soundtrack_noise(text: str | None) -> str:
    normalized = normalize_title(text)
    for noise in _SOUNDTRACK_NOISE:
        normalized = normalized.replace(noise, " ")
    return re.sub(r"\s+", " ", normalized).strip()


def title_matches(candidate: str | None, wanted: str | None) -> bool:
    """Whether a release-group title names the typed media: a prefix match
    either way on the noise-stripped titles (a substring would be too loose)."""
    left, right = strip_soundtrack_noise(candidate), strip_soundtrack_noise(wanted)
    if len(right) < _MIN_TITLE_CHARS or not left:
        return False
    return left == right or left.startswith(f"{right} ") or right.startswith(f"{left} ")


def numbering(item_ids: list[int]) -> dict[int, int]:
    return {item_id: index for index, item_id in enumerate(item_ids, start=1)}


def _release_group_id(title: str) -> str | None:
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
    """The media's artwork (poster, key art) from its soundtrack release on the
    Cover Art Archive. Only the picture is borrowed."""
    group_id = _release_group_id(title)
    if not group_id:
        return None
    return enrich._caa_front(f"release-group/{group_id}")


def thumbnail_cover(url: str) -> tuple[tuple[bytes, bool], tuple[bytes, bool]] | None:
    """The video thumbnail, as a placeholder cover."""
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
    """File every item under the user-named album and return its row.

    The rows the items leave are dropped, or %aunique would suffix the folder."""
    numbers = numbering([item.id for item in items])
    left_behind = {item.album_id for item in items if item.album_id is not None}

    for item in items:
        item.album = spec["title"]
        item.albumartist = spec["artist"]
        item.track = numbers[item.id]
        item.tracktotal = len(items)
        # `comp` is left alone: beets would route a compilation to Compilations/,
        # ignoring the typed album artist. `mb_trackid` stays; the recording is true.
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
        enrich.drop_emptied_row(lib, row)

    # %aunique memoizes per Library; reset it now the dropped rows are gone.
    lib._memotable = {}
    album.try_sync(write=True, move=True)
    protocol.log(
        f"forced_album: « {spec['title']} » by {spec['artist']} "
        f"holds {len(items)} track(s)"
    )
    return album


def ensure_cover(lib, album, items, spec: dict) -> bool:
    """Give the forced album a cover: the media's artwork, else the thumbnail.
    Returns True when the thumbnail placeholder was used."""
    cover, provisional = None, False
    if is_media_category(spec["category"]):
        cover = media_cover(spec["title"])
    if cover is None:
        cover = thumbnail_cover(spec["thumbnail"])
        provisional = cover is not None
    if cover is None:
        protocol.log("forced_album: no cover found, album left bare")
        return False

    # Shown in the metadata panel: names the kind of picture, not the site.
    source = "Video thumbnail" if provisional else "Cover Art Archive"
    try:
        enrich.set_album_art(album, *cover, source=source)
        for item in items:
            enrich.embed_cover(item, *cover)
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
