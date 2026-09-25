"""Read the beets library (SQLite). Read-only: the importer is the only writer.

Listing reads SQLite columns directly instead of beets' ORM, which builds a
full `Item` per track (~1.7 s vs ~80 ms on 10 000 tracks). All writes still
go through beets' API.
"""

import os
import sqlite3

import accepted

from genre_tree import bucket_for

# beets' DB delimiter for multi-valued tags ("; " when read from file tags).
_GENRE_DB_DELIMITER = "\\␀"
_GENRE_FMT_DELIMITER = "; "

# Flexible attributes surfaced to the front.
_BONUS_SOURCE_KEY = "sonarche_bonus_source"
_SUSPECT_KEY = "sonarche_suspect_match"
PROVISIONAL_COVER_KEY = "sonarche_provisional_cover"
# On the album row. Absent means a regular album; COLLECTION means a
# user-made gathering with no tracklist to be incomplete against.
ALBUM_KIND_KEY = "sonarche_album_kind"
COLLECTION = "collection"
# Singletons only: the cover extracted from the file's tags at import.
ITEM_ART_KEY = "sonarche_item_art"

_ITEM_COLUMNS = (
    "id, title, artist, album, albumartist, year, genres, track, tracktotal,"
    " length, bitrate, format, path, album_id, added, mb_trackid, grouping,"
    " albumtypes"
)


def _decode(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def expand_db_path(stored, library_dir: str) -> str | None:
    """Absolute path for a path as beets stores it (relative to the library
    directory, POSIX separators). Mirrors `expand_path_from_db`.
    """
    if not stored:
        return None
    path = _decode(stored)
    if os.path.isabs(path):
        return path
    return os.path.normpath(os.path.join(library_dir, path.replace("/", os.sep)))


def split_multi(stored: str | None) -> list[str]:
    if not stored:
        return []
    delimiter = (
        _GENRE_DB_DELIMITER if _GENRE_DB_DELIMITER in stored else _GENRE_FMT_DELIMITER
    )
    return [part.strip() for part in stored.split(delimiter) if part.strip()]


def first_genre(stored: str | None) -> str | None:
    return next(iter(split_multi(stored)), None)


def art_paths_by_album(conn, library_dir: str) -> dict[int, str | None]:
    """{album_id: artpath}, resolved once per album rather than per track."""
    return {
        row["id"]: expand_db_path(row["artpath"], library_dir)
        for row in conn.execute("SELECT id, artpath FROM albums")
    }


def art_mtimes(art_by_album: dict[int, str | None]) -> dict[int, int]:
    """{album_id: cover mtime}, used to version cover URLs: replacing a cover
    keeps the same artpath, and the webview would cache the old image.
    """
    mtimes: dict[int, int] = {}
    for album_id, path in art_by_album.items():
        if not path:
            continue
        try:
            mtimes[album_id] = int(os.stat(path).st_mtime)
        except OSError:
            pass
    return mtimes


def flex_attrs_by_item(conn, key: str) -> dict[int, str]:
    """{item_id: value} for one flexible attribute, in a single query."""
    return {
        row["entity_id"]: row["value"]
        for row in conn.execute(
            "SELECT entity_id, value FROM item_attributes WHERE key = ?",
            (key,),
        )
        if row["value"]
    }


def flex_attrs_by_album(conn, key: str) -> dict[int, str]:
    """Album-row counterpart of `flex_attrs_by_item` (`album_attributes`)."""
    return {
        row["entity_id"]: row["value"]
        for row in conn.execute(
            "SELECT entity_id, value FROM album_attributes WHERE key = ?",
            (key,),
        )
        if row["value"]
    }


class Lookups:
    """Per-listing lookups `track_row` needs beyond the row itself, keyed by
    item or album id."""

    __slots__ = (
        "art_by_album",
        "art_mtime_by_album",
        "bonus_by_item",
        "suspect_by_item",
        "provisional_cover_by_item",
        "kind_by_album",
        "art_by_item",
        "accepted_by_item",
        "accepted_by_album",
    )

    def __init__(self, **fields):
        for name in self.__slots__:
            setattr(self, name, fields.pop(name, None) or {})
        if fields:
            raise TypeError(f"unknown lookup: {', '.join(sorted(fields))}")


def track_row(row, lookups: "Lookups", library_dir: str) -> dict:
    """One SQLite row -> the wire shape the front consumes."""
    genre = first_genre(row["genres"])
    return {
        "id": row["id"],
        "title": row["title"],
        "artist": row["artist"],
        "album": row["album"],
        "album_artist": row["albumartist"],
        "year": row["year"] or None,
        "genre": genre,
        "genre_bucket": bucket_for(genre),
        "track": row["track"] or None,
        "track_total": row["tracktotal"] or None,
        "length": round(row["length"], 1) if row["length"] else None,
        "bitrate": row["bitrate"] or None,
        "format": row["format"],
        "path": expand_db_path(row["path"], library_dir),
        "album_id": row["album_id"] or None,
        # Singletons have no album row; fall back to their extracted cover.
        "art_path": lookups.art_by_album.get(row["album_id"]) or lookups.art_by_item.get(row["id"]),
        "art_mtime": lookups.art_mtime_by_album.get(row["album_id"]),
        # Origin release of an adopted bonus track.
        "bonus_source": lookups.bonus_by_item.get(row["id"]),
        # beets stores "" for "no match".
        "mb_trackid": row["mb_trackid"] or None,
        # User-defined category (grouping tag), orthogonal to genre.
        "category": row["grouping"] or None,
        "soundtrack": "soundtrack" in split_multi(row["albumtypes"]),
        "suspect_match": row["id"] in lookups.suspect_by_item,
        # The cover is a video thumbnail placeholder.
        "provisional_cover": row["id"] in lookups.provisional_cover_by_item,
        "album_kind": lookups.kind_by_album.get(row["album_id"]),
        # Checks already accepted, on the track or on its album.
        "accepted": sorted(accepted.parse(lookups.accepted_by_item.get(row["id"]))),
        "album_accepted": sorted(accepted.parse(lookups.accepted_by_album.get(row["album_id"]))),
        "added": row["added"],
    }


def handle(_request_id: str, params: dict) -> dict:
    db_path = params["beets_db"]
    if not os.path.exists(db_path):
        return {"tracks": []}

    library_dir = params["library_dir"]
    # Read-only by URI, so this can never write to beets' DB. The busy timeout
    # waits out an import's write lock on the other sidecar process (measured
    # up to 8 s), and stays under the caller's 60 s timeout.
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=20.0)
    conn.row_factory = sqlite3.Row
    try:
        art_by_album = art_paths_by_album(conn, library_dir)
        art_mtime_by_album = art_mtimes(art_by_album)
        bonus_by_item = flex_attrs_by_item(conn, _BONUS_SOURCE_KEY)
        suspect_by_item = flex_attrs_by_item(conn, _SUSPECT_KEY)
        provisional_cover_by_item = flex_attrs_by_item(conn, PROVISIONAL_COVER_KEY)
        kind_by_album = flex_attrs_by_album(conn, ALBUM_KIND_KEY)
        art_by_item = flex_attrs_by_item(conn, ITEM_ART_KEY)
        accepted_by_item = flex_attrs_by_item(conn, accepted.KEY)
        accepted_by_album = flex_attrs_by_album(conn, accepted.KEY)
        # COALESCE keeps rows without `added` at the bottom.
        rows = conn.execute(
            f"SELECT {_ITEM_COLUMNS} FROM items ORDER BY COALESCE(added, 0) DESC"
        )
        lookups = Lookups(
            art_by_album=art_by_album,
            art_mtime_by_album=art_mtime_by_album,
            bonus_by_item=bonus_by_item,
            suspect_by_item=suspect_by_item,
            provisional_cover_by_item=provisional_cover_by_item,
            kind_by_album=kind_by_album,
            art_by_item=art_by_item,
            accepted_by_item=accepted_by_item,
            accepted_by_album=accepted_by_album,
        )
        tracks = [track_row(r, lookups, library_dir) for r in rows]
    finally:
        conn.close()

    return {"tracks": tracks}


def remove(_request_id: str, params: dict) -> dict:
    """Remove a track and delete its file, through beets' API so an emptied
    album is cleaned up too."""
    from beets.library import Library

    db_path = params["beets_db"]
    if not os.path.exists(db_path):
        raise RuntimeError("library not found")

    lib = Library(db_path, directory=params["library_dir"])
    item = lib.get_item(params["id"])
    if item is None:
        raise RuntimeError(f"track not found: id={params['id']}")

    item.remove(delete=True)
    return {"removed": True}


# Free-text tags the UI may overwrite; keys are beets attribute names.
_TEXT_FIELDS = ("title", "artist", "albumartist", "album", "grouping")
# Only identity edits answer a suspect-match flag.
_IDENTITY_FIELDS = frozenset(("title", "artist", "albumartist", "album"))
# Album-row fields used by the path format: editing them moves the file.
_ALBUM_FIELDS = frozenset(("album", "albumartist"))
# beets stores 0 for "absent".
_INT_FIELDS = ("year", "track", "tracktotal")


def _coerce_int(raw) -> int | None:
    """Empty -> 0 (unset); non-numeric -> None, so the field is skipped."""
    text = str(raw).strip()
    if not text:
        return 0
    try:
        return int(text)
    except ValueError:
        return None


def _apply_fields(item, fields: dict) -> set[str]:
    """Assign only changed fields. Returns the changed attribute names."""
    touched: set[str] = set()
    for key in _TEXT_FIELDS:
        if key not in fields:
            continue
        new = str(fields[key]).strip()
        if (getattr(item, key, "") or "") != new:
            setattr(item, key, new)
            touched.add(key)
    for key in _INT_FIELDS:
        if key not in fields:
            continue
        new = _coerce_int(fields[key])
        if new is None:
            continue
        if (getattr(item, key, 0) or 0) != new:
            setattr(item, key, new)
            touched.add(key)
    if "genre" in fields:
        # The app edits one primary genre; split only so a pasted "Rock; Metal"
        # round-trips.
        raw = str(fields["genre"]).strip()
        new = [g.strip() for g in raw.split(";") if g.strip()]
        if list(item.get("genres", with_album=False) or []) != new:
            item.genres = new
            touched.add("genres")
    return touched


def update(_request_id: str, params: dict) -> dict:
    """Apply metadata edits to a batch of tracks in one Library session.

    Writes go through beets so DB and tags stay in sync; a failed tag write is
    logged, not fatal. Album or artist edits also move files, since they change
    where the track is filed."""
    from beets.library import Library

    import covers
    import provenance

    db_path = params["beets_db"]
    if not os.path.exists(db_path):
        raise RuntimeError("library not found")

    lib = Library(db_path, directory=params["library_dir"])
    updated = 0
    # Captured before the first move removes the old folder.
    art_dirs: dict[int, str | None] = {}
    # Album-level edits, grouped per album so each album is re-filed once.
    album_edits: dict[int, dict[str, str]] = {}
    solo: list = []
    # old -> new albumartist, so Rust can move the artist image along.
    artist_renames: dict[tuple[str, str], None] = {}

    for entry in params.get("updates") or []:
        item = lib.get_item(entry["id"])
        if item is None:
            continue
        old_artist = (getattr(item, "albumartist", "") or "").strip()
        changed = _apply_fields(item, entry.get("fields") or {})
        if not changed:
            continue
        if "albumartist" in changed:
            new_artist = (item.albumartist or "").strip()
            if old_artist and new_artist and old_artist != new_artist:
                artist_renames[(old_artist, new_artist)] = None
        provenance.mark_edited(item, changed)
        # A human re-identified the item: the review flag is answered.
        if changed & _IDENTITY_FIELDS and item.get(_SUSPECT_KEY):
            del item[_SUSPECT_KEY]

        filing = changed & _ALBUM_FIELDS
        if item.album_id is not None and filing:
            art_dirs.setdefault(item.album_id, _album_art_dir(lib, item.album_id))
            album_edits.setdefault(item.album_id, {}).update(
                {key: getattr(item, key) for key in filing}
            )
            # Stored, not synced: the album pass below writes and moves its items.
            item.store()
        else:
            solo.append(item)
        updated += 1

    # beets computes destinations from the album row, so change the row.
    for album_id, fields in album_edits.items():
        album = lib.get_album(album_id)
        if album is None:
            continue
        for key, value in fields.items():
            setattr(album, key, value)
        album.try_sync(write=True, move=True)

    # Singletons and non-filing edits. try_sync logs tag-write failures.
    for item in solo:
        item.try_sync(write=True, move=True)

    # Sweep legacy `cover-hq.*` files so the vacated folder can be pruned.
    for album_id, old_dir in art_dirs.items():
        album = lib.get_album(album_id)
        art = _decode(album.artpath) if album is not None and album.artpath else None
        new_dir = os.path.dirname(art) if art else None
        if not old_dir or not new_dir or old_dir == new_dir or not os.path.isdir(old_dir):
            continue
        covers.remove_legacy_archives(old_dir)
        try:
            if not os.listdir(old_dir):
                os.rmdir(old_dir)
        except OSError:
            pass

    return {
        "updated": updated,
        "artist_renames": [{"old": old, "new": new} for old, new in artist_renames],
    }


def _album_art_dir(lib, album_id: int) -> str | None:
    album = lib.get_album(album_id)
    art = _decode(album.artpath) if album is not None and album.artpath else None
    return os.path.dirname(art) if art else None
