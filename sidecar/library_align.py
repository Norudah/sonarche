"""Align imported albums with MusicBrainz, one text search per album.

- `scan` searches a release for each album without a MusicBrainz id and
  returns a plan of fields to fill. Nothing is stored.
- `apply` writes the plan, re-checking every guard at write time.

Non-destructive: only blank fields are written, nothing is deleted and files
are never moved.
"""

import os
import time

import enrich
import library
import metadata
import protocol
import provenance

# No fingerprint safety net for text search: near-perfect hits only.
_MAX_ALBUM_DISTANCE = 0.15

# beets paces MusicBrainz itself; this only spaces out albums.
_DEFAULT_SEARCH_PAUSE_SECONDS = 0.0

# Between Last.fm genre fetches; the host passes the user's setting.
_DEFAULT_FETCH_PAUSE_SECONDS = 1.0

# Plans coming over IPC are filtered against this list, so a forged plan
# cannot write `path` or other fields.
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

ALBUM_FILL_FIELDS = (
    "album",
    "albumartist",
    "year",
    "mb_albumid",
    "mb_albumartistid",
    "mb_releasegroupid",
)


def blank(value) -> bool:
    """Whether a field is unfilled (beets stores 0 or "" for absent)."""
    return value is None or value == "" or value == 0


def acceptable(distance: float, extra_items: int) -> bool:
    """Whether a candidate is trusted: every file maps onto the release, within
    the strict text-match distance."""
    return extra_items == 0 and distance <= _MAX_ALBUM_DISTANCE


def plan_fills(current: dict, candidate: dict, edited: set, fields=FILL_FIELDS) -> dict:
    """Candidate values for fields that are blank and never hand-edited."""
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
    """The plan entry for one matched album: release_* fields for display,
    `fills` for apply."""
    info = match.info
    item_entries = []
    for item, track in match.mapping.items():
        candidate = enrich.work_fields(track.merge_with_album(info))
        fills = plan_fills(
            {field: item.get(field) for field in FILL_FIELDS},
            candidate,
            _edited_fields(item),
        )
        # MB genres go through the genre pipeline at apply time, not written as-is.
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
    """Build the plan for albums without a MusicBrainz id."""
    from beets.library import Library

    metadata.ensure_plugins()
    pause = max(
        0.0, float(params.get("search_pause_seconds", _DEFAULT_SEARCH_PAUSE_SECONDS))
    )
    lib = Library(params["beets_db"], directory=params["library_dir"])

    # Collections have no release to match.
    targets = [
        album
        for album in lib.albums()
        if blank(album.get("mb_albumid"))
        and album.get(library.ALBUM_KIND_KEY) != library.COLLECTION
    ]
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
    enrich.set_album_art(album, *cover)
    for item in items:
        enrich.embed_cover(item, *cover)
    return True


def _apply_item(lib, entry: dict, lastgenre) -> tuple[bool, bool, bool]:
    """Write one plan item, guards re-checked. Returns (stored, genre_filled,
    paid_lastfm); the last drives pacing.

    Genre goes through the pipeline: MB genres canonicalize offline, and only a
    genre-less item costs a Last.fm call."""
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
            # Nothing resolved: keep the raw MB genres for the off-tree triage.
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
    """Write a scan plan back. Albums aligned or removed since the scan are
    skipped, as are fields filled or edited since."""
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
