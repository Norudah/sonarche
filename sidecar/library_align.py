"""Align an imported library's albums with MusicBrainz — one search per album.

The tier between "fetch covers" and "fingerprint everything": an imported
album usually carries usable tags, so a single text search per album folder
identifies the release for the cost of ~1 request instead of one fingerprint
lookup per track. Two handlers, split so MusicBrainz is only paid once:

- ``scan`` walks every album row without a MusicBrainz identity, searches a
  release from the row's own tags, and returns a *plan* — per item and per
  album, the fields a fill pass would write. Nothing is stored.
- ``apply`` takes that plan back and writes it, re-checking every guard at
  write time (a field filled or hand-edited since the scan is left alone).

Deliberately non-destructive, unlike the download path in enrich_album: only
blank fields are written, nothing is ever deleted, and files are never moved —
a stale folder name is a cosmetic debt; a mass rename is not undoable.
"""

import os
import time

import enrich
import metadata
import protocol
import provenance

# The text search has no fingerprint safety net: near-perfect hits only (same
# bar as enrich_album's text fallback).
_MAX_ALBUM_DISTANCE = 0.15

# MusicBrainz pacing is handled by beets' client (~1 req/s); this pause only
# adds breathing room between albums for the UI and the log.
_DEFAULT_SEARCH_PAUSE_SECONDS = 0.0

# Between Last.fm genre fetches at apply time — the shared-key politeness the
# genre pass observes everywhere (see genres.py). The Rust host passes the
# user's configured delay; this is only a fallback for direct invocations.
_DEFAULT_FETCH_PAUSE_SECONDS = 1.0

# Every field the fill pass may write on an item. A plan entry crossing the
# IPC boundary is filtered against this list, so a forged plan cannot reach
# `path` or any other field the pass has no business touching.
FILL_FIELDS = (
    "title",
    "artist",
    "album",
    "albumartist",
    "year",
    "track",
    "tracktotal",
    "mb_trackid",
    "mb_releasetrackid",
    "mb_albumid",
    "mb_artistid",
    "mb_albumartistid",
    "mb_releasegroupid",
)

# Same idea for the album row.
ALBUM_FILL_FIELDS = (
    "album",
    "albumartist",
    "year",
    "mb_albumid",
    "mb_albumartistid",
    "mb_releasegroupid",
)


def blank(value) -> bool:
    """Whether a field counts as unfilled. Pure. beets stores 0 for a missing
    year/track and "" for a missing id — both are absences, not values."""
    return value is None or value == "" or value == 0


def acceptable(distance: float, extra_items: int) -> bool:
    """Whether a candidate release is trusted. Pure. Every local file must map
    onto the release (a leftover means this probably isn't the album), and the
    distance bar is the strict one text matches get without a fingerprint."""
    return extra_items == 0 and distance <= _MAX_ALBUM_DISTANCE


def plan_fills(current: dict, candidate: dict, edited: set, fields=FILL_FIELDS) -> dict:
    """The fields a fill pass would write: candidate values for fields blank
    today, skipping anything a human ever touched. Pure."""
    fills = {}
    for field in fields:
        value = candidate.get(field)
        if blank(current.get(field)) and not blank(value) and field not in edited:
            fills[field] = value
    return fills


def _edited_fields(item) -> set:
    recorded = str(item.get(provenance.EDITED_FIELDS) or "")
    return {field for field in recorded.split(",") if field}


def _search_release(items, album):
    """One text search for the album row; the accepted match or None."""
    from beets import autotag

    artist = str(album.get("albumartist") or "") or None
    name = str(album.get("album") or "") or None
    if not (artist or name):
        return None
    _, _, proposal = autotag.tag_album(items, search_artist=artist, search_name=name)
    for match in proposal.candidates[:1]:
        if acceptable(float(match.distance), len(match.extra_items)):
            return match
    return None


def _cover_missing(album) -> bool:
    art = enrich._decode(album.artpath) if album.artpath else None
    return not art or not os.path.exists(art)


def _album_plan(album, match) -> dict:
    """The plan entry for one matched album. Display fields (release_*) are for
    the front's verdict list; `fills` are what apply would write."""
    info = match.info
    item_entries = []
    for item, track in match.mapping.items():
        candidate = enrich.work_fields(track.merge_with_album(info))
        fills = plan_fills(
            {field: item.get(field) for field in FILL_FIELDS},
            candidate,
            _edited_fields(item),
        )
        # MusicBrainz' community genres ride along outside the fills: they are
        # not written as-is but seeded through the genre pipeline at apply time,
        # so the curated tree keeps its say (same policy as enrich).
        genres = [str(g) for g in (candidate.get("genres") or []) if g]
        if fills or genres:
            item_entries.append({"item_id": item.id, "fills": fills, "genres": genres})
    album_fills = plan_fills(
        {field: album.get(field) for field in ALBUM_FILL_FIELDS},
        {
            "album": info.album,
            "albumartist": info.artist,
            "year": info.year,
            "mb_albumid": info.album_id,
            "mb_albumartistid": info.artist_id,
            "mb_releasegroupid": info.releasegroup_id,
        },
        set(),
        fields=ALBUM_FILL_FIELDS,
    )
    return {
        "album_id": album.id,
        "album": str(album.get("album") or ""),
        "albumartist": str(album.get("albumartist") or ""),
        "release_id": info.album_id,
        "release_group_id": info.releasegroup_id,
        "release_title": info.album,
        "release_artist": info.artist,
        "release_year": info.year,
        "cover_missing": _cover_missing(album),
        "items": item_entries,
        "album_fills": album_fills,
    }


def scan(request_id: str, params: dict) -> dict:
    """Walk the albums without a MusicBrainz identity and build the plan."""
    from beets.library import Library

    metadata.ensure_plugins()
    pause = max(
        0.0, float(params.get("search_pause_seconds", _DEFAULT_SEARCH_PAUSE_SECONDS))
    )
    lib = Library(params["beets_db"], directory=params["library_dir"])

    targets = [album for album in lib.albums() if blank(album.get("mb_albumid"))]
    total = len(targets)
    protocol.log(f"library_align: scanning {total} album(s) without a release id")
    entries = []
    for done, album in enumerate(targets, start=1):
        protocol.send_event(
            request_id,
            "library_align_progress",
            {
                "stage": "scan",
                "done": done,
                "total": total,
                "album": str(album.get("album") or ""),
            },
        )
        items = list(album.items())
        if not items:
            continue
        try:
            match = _search_release(items, album)
        except Exception as exc:  # one unreachable album must not sink the scan
            protocol.log(f"library_align: album {album.id} search failed: {exc}")
            match = None
        if match is not None:
            entry = _album_plan(album, match)
            protocol.log(
                f"library_align: « {entry['album']} » -> {entry['release_id']} "
                f"({len(entry['items'])} item(s) to fill)"
            )
            entries.append(entry)
        if pause > 0 and done < total:
            time.sleep(pause)
    return {"scanned": total, "matched": len(entries), "albums": entries}


def _fetch_cover(album, items, release_id: str, release_group_id: str | None) -> bool:
    try:
        protocol.log(f"library_align: fetching cover for release {release_id}")
        cover = enrich.download_cover(release_id, release_group_id)
    except Exception as exc:  # metadata landed; a missing cover is not a failure
        protocol.log(f"library_align: cover fetch failed: {exc}")
        return False
    if cover is None:
        return False
    hq, thumb = cover
    enrich.set_album_art(album, *thumb)
    enrich.save_hq_cover(album, *hq)
    for item in items:
        enrich.embed_cover(item, *thumb)
    return True


def _apply_item(lib, entry: dict, lastgenre) -> tuple[bool, bool, bool]:
    """Write one plan item, every guard re-checked at write time. Returns
    (stored, genre_filled, paid_lastfm) — the last drives the caller's pacing.

    Genre is filled through the pipeline, never from the plan as-is: the MB
    community genres seed the item, `_get_genre` canonicalizes them against the
    curated tree offline, and only a genre-less item with no MB genres costs a
    Last.fm round-trip (same policy and same order as enrich)."""
    item = lib.get_item(int(entry.get("item_id") or 0))
    if item is None:
        return False, False, False
    raw = entry.get("fills") or {}
    fills = plan_fills(
        {field: item.get(field) for field in FILL_FIELDS},
        {field: raw.get(field) for field in FILL_FIELDS},
        _edited_fields(item),
    )

    genre_filled = paid_lastfm = False
    had_genre = bool(item.get("genres", with_album=False))
    if not had_genre and not provenance.was_hand_edited(item, "genres"):
        seeded = [g for g in (entry.get("genres") or []) if isinstance(g, str) and g]
        if seeded:
            item.genres = seeded
        paid_lastfm = not seeded
        try:
            genres, label = lastgenre._get_genre(item)
        except Exception as exc:  # a genre is a bonus, never a failure
            protocol.log(f"library_align: genre lookup failed: {exc}")
            genres, label = None, None
        if genres:
            item.genres = genres
            genre_filled = True
            protocol.log(f"library_align: genre {genres} ({label})")
        elif seeded:
            # Nothing resolved against the tree: keep the raw MB genres rather
            # than erasing them — the off-tree triage line will say so.
            genre_filled = True

    if not fills and not genre_filled:
        return False, False, paid_lastfm
    if fills:
        item.update(fills)
        if "mb_trackid" in fills:
            provenance.mark_match(item, "text")
    item.store()
    try:
        item.write()
    except Exception as exc:  # DB is authoritative; file tags are best-effort
        protocol.log(f"library_align: tag write failed: {exc}")
    return True, genre_filled, paid_lastfm


def apply(request_id: str, params: dict) -> dict:
    """Write a scan plan back. Albums aligned (or removed) since the scan are
    skipped whole; fields filled or hand-edited since are skipped one by one."""
    from beets.library import Library

    metadata.ensure_plugins()
    lastgenre = metadata.lastgenre_plugin()
    pause = max(0.0, float(params.get("fetch_pause_seconds", _DEFAULT_FETCH_PAUSE_SECONDS)))
    lib = Library(params["beets_db"], directory=params["library_dir"])
    entries = (params.get("plan") or {}).get("albums") or []
    total = len(entries)
    albums_updated = items_updated = covers_fetched = genres_filled = 0
    for done, entry in enumerate(entries, start=1):
        protocol.send_event(
            request_id,
            "library_align_progress",
            {
                "stage": "apply",
                "done": done,
                "total": total,
                "album": str(entry.get("album") or ""),
            },
        )
        album = lib.get_album(int(entry.get("album_id") or 0))
        if album is None or not blank(album.get("mb_albumid")):
            continue
        touched = False
        for item_entry in entry.get("items") or []:
            stored, genre_filled, paid_lastfm = _apply_item(lib, item_entry, lastgenre)
            if stored:
                items_updated += 1
                touched = True
            if genre_filled:
                genres_filled += 1
            # Only a real Last.fm round-trip paces the loop, as everywhere else.
            if paid_lastfm and pause > 0:
                time.sleep(pause)
        raw = entry.get("album_fills") or {}
        album_fills = plan_fills(
            {field: album.get(field) for field in ALBUM_FILL_FIELDS},
            {field: raw.get(field) for field in ALBUM_FILL_FIELDS},
            set(),
            fields=ALBUM_FILL_FIELDS,
        )
        if album_fills:
            for field, value in album_fills.items():
                album[field] = value
            album.store()
            touched = True
        if touched:
            albums_updated += 1
        release_id = str(entry.get("release_id") or "")
        if entry.get("cover_missing") and release_id and _cover_missing(album):
            if _fetch_cover(
                album,
                list(album.items()),
                release_id,
                str(entry.get("release_group_id") or "") or None,
            ):
                covers_fetched += 1
    protocol.log(
        f"library_align: applied {albums_updated} album(s), {items_updated} item(s), "
        f"{covers_fetched} cover(s), {genres_filled} genre(s)"
    )
    return {
        "albums_updated": albums_updated,
        "items_updated": items_updated,
        "covers_fetched": covers_fetched,
        "genres_filled": genres_filled,
    }
