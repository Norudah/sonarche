"""Read the beets library (SQLite). Read-only: the importer is the only writer.

The listing path reads the SQLite columns directly rather than going through
beets' ORM. `lib.items()` builds a full `Item` per track — 98 fields plus the
machinery to mutate and re-save them — and we keep 15 of those fields and
discard the rest. That object is the right tool for tagging, which is what
beets is for; it is the wrong tool for "hand me the whole library to display".
Measured on a 10 000-track library: ~1730 ms through the ORM, ~80 ms in SQL.

Everything that *writes* (import, enrich, remove) still goes through beets'
API, which is what the architecture invariant asks for: read its SQLite, never
write it directly.
"""

import os
import sqlite3

from genre_tree import bucket_for

# beets joins multi-valued tags with this in the DB, and formats them with "; "
# when the value came from a file's own tags. `DelimitedString.parse` accepts
# either, so we do too.
_GENRE_DB_DELIMITER = "\\␀"
_GENRE_FMT_DELIMITER = "; "

# Flexible (non-column) attributes we surface. Anything not listed here stays
# in item_attributes and is never read.
_BONUS_SOURCE_KEY = "sonarche_bonus_source"
_SUSPECT_KEY = "sonarche_suspect_match"

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
    """Absolute path for a path as beets stores it.

    Beets keeps paths *relative* to the library directory when the file lives
    under it, with a POSIX separator regardless of platform, and absolute
    otherwise. The ORM expands them on read; reading the column ourselves means
    doing it ourselves. Mirrors `beets.dbcore.pathutils.expand_path_from_db` —
    skipping this yields paths that look plausible and resolve to nothing.
    """
    if not stored:
        return None
    path = _decode(stored)
    if os.path.isabs(path):
        return path
    return os.path.normpath(os.path.join(library_dir, path.replace("/", os.sep)))


def split_multi(stored: str | None) -> list[str]:
    """Values of a beets multi-valued column, whichever delimiter it used."""
    if not stored:
        return []
    delimiter = (
        _GENRE_DB_DELIMITER if _GENRE_DB_DELIMITER in stored else _GENRE_FMT_DELIMITER
    )
    return [part.strip() for part in stored.split(delimiter) if part.strip()]


def first_genre(stored: str | None) -> str | None:
    """Primary genre out of beets' delimited `genres` column."""
    return next(iter(split_multi(stored)), None)


def _art_path(artpath: str | None) -> str | None:
    """Sonarche displays the HQ cover (cover-hq.*) next to beets' own artpath
    (the 500px thumb it embeds/tracks); fall back to the artpath itself for
    albums enriched before the HQ/thumb split."""
    if not artpath:
        return None
    art_dir = os.path.dirname(artpath)
    for ext in ("jpg", "png"):
        hq_path = os.path.join(art_dir, f"cover-hq.{ext}")
        if os.path.exists(hq_path):
            return hq_path
    return artpath


def art_paths_by_album(conn, library_dir: str) -> dict[int, str | None]:
    """Resolve every album's cover once, up front.

    Cover art is an album-level property; resolving it per track meant one
    query and two stat() calls each, to answer a question with one answer per
    album. Keeps the work proportional to albums, not tracks.
    """
    return {
        row["id"]: _art_path(expand_db_path(row["artpath"], library_dir))
        for row in conn.execute("SELECT id, artpath FROM albums")
    }


def flex_attrs_by_item(conn, key: str) -> dict[int, str]:
    """One surfaced flexible attribute for the whole library — they live in
    item_attributes rather than columns. One indexed query per key instead of
    a lookup per track."""
    return {
        row["entity_id"]: row["value"]
        for row in conn.execute(
            "SELECT entity_id, value FROM item_attributes WHERE key = ?",
            (key,),
        )
        if row["value"]
    }


def track_row(row, art_by_album, bonus_by_item, suspect_by_item, library_dir: str) -> dict:
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
        # Broad browse family (e.g. "Metal") derived from the specific genre.
        "genre_bucket": bucket_for(genre),
        "track": row["track"] or None,
        "track_total": row["tracktotal"] or None,
        "length": round(row["length"], 1) if row["length"] else None,
        "bitrate": row["bitrate"] or None,
        "format": row["format"],
        "path": expand_db_path(row["path"], library_dir),
        # Singletons carry no album_id and simply miss.
        "art_path": art_by_album.get(row["album_id"]),
        # Origin release of an adopted bonus track (deluxe/regional
        # edition filed with the main album), or None.
        "bonus_source": bonus_by_item.get(row["id"]),
        # Empty string is beets' "no match" — surface it as null.
        "mb_trackid": row["mb_trackid"] or None,
        # The user's own axis (grouping tag): context, not musical style.
        "category": row["grouping"] or None,
        # MusicBrainz marked the release a soundtrack — the UI's cue to
        # pre-suggest a category, since MB can't tell film from game.
        "soundtrack": "soundtrack" in split_multi(row["albumtypes"]),
        # The match contradicts the download's own title (see suspect.py):
        # shown by the triage page as "to review".
        "suspect_match": row["id"] in suspect_by_item,
        "added": row["added"],
    }


def handle(_request_id: str, params: dict) -> dict:
    db_path = params["beets_db"]
    if not os.path.exists(db_path):
        return {"tracks": []}

    library_dir = params["library_dir"]
    # Read-only: the URI form makes that a guarantee rather than a convention,
    # so a bug here can never touch the library beets owns.
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        art_by_album = art_paths_by_album(conn, library_dir)
        bonus_by_item = flex_attrs_by_item(conn, _BONUS_SOURCE_KEY)
        suspect_by_item = flex_attrs_by_item(conn, _SUSPECT_KEY)
        # Sorted in SQLite rather than in Python. COALESCE keeps a row with no
        # `added` at the bottom instead of letting NULL sort unpredictably.
        rows = conn.execute(
            f"SELECT {_ITEM_COLUMNS} FROM items ORDER BY COALESCE(added, 0) DESC"
        )
        tracks = [
            track_row(r, art_by_album, bonus_by_item, suspect_by_item, library_dir) for r in rows
        ]
    finally:
        conn.close()

    return {"tracks": tracks}


def remove(_request_id: str, params: dict) -> dict:
    """Remove a track from the library and delete its file. Goes through beets'
    API (not raw SQL) so the DB and any now-empty album stay consistent."""
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


# Free-text tags we let the UI overwrite wholesale. Keys are beets' own item
# attribute names, so the wire shape maps 1:1 onto `setattr`. `grouping` is the
# category axis (context: Video Games, Film, …), orthogonal to genre.
_TEXT_FIELDS = ("title", "artist", "albumartist", "album", "grouping")
# Fields whose edit answers a suspect match: the review flag is about *what the
# audio is*, so only identity edits lift it — setting a category or fixing a
# track number leaves the question open.
_IDENTITY_FIELDS = frozenset(("title", "artist", "albumartist", "album"))
# Integer tags: beets stores 0 for "absent", so an emptied field clears to 0.
_INT_FIELDS = ("year", "track", "tracktotal")


def _coerce_int(raw) -> int | None:
    """Empty -> 0 (beets' "unset"); non-numeric -> None so the caller skips the
    field rather than aborting the whole batch on one fat-fingered value."""
    text = str(raw).strip()
    if not text:
        return 0
    try:
        return int(text)
    except ValueError:
        return None


def _apply_fields(item, fields: dict) -> set[str]:
    """Assign only the fields that actually change, so an unchanged track is
    never re-stored or re-tagged. Returns the item attribute names that moved
    (empty set: nothing did)."""
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
        # The UI edits the primary genre as one value; beets' column is the
        # multi-valued `genres`. We collapse to the single edited value (the
        # app's genre model is one-primary + derived bucket), splitting on the
        # display delimiter only so a pasted "Rock; Metal" round-trips.
        raw = str(fields["genre"]).strip()
        new = [g.strip() for g in raw.split(";") if g.strip()]
        if list(item.get("genres", with_album=False) or []) != new:
            item.genres = new
            touched.add("genres")
    return touched


def update(_request_id: str, params: dict) -> dict:
    """Apply metadata edits to a batch of tracks in one library session.

    One Library open for the whole batch, not one per track: the cost is N tag
    writes (each track is its own file — irreducible) plus a single DB session,
    instead of N process round-trips. Writes go through beets' API so DB and
    tags stay in sync (the source-of-truth invariant). A failed *tag* write is
    logged, not fatal — the DB store already holds the truth, and the file may
    be momentarily locked or read-only."""
    from beets.library import Library

    import protocol
    import provenance

    db_path = params["beets_db"]
    if not os.path.exists(db_path):
        raise RuntimeError("library not found")

    lib = Library(db_path, directory=params["library_dir"])
    updated = 0
    for entry in params.get("updates") or []:
        item = lib.get_item(entry["id"])
        if item is None:
            continue
        changed = _apply_fields(item, entry.get("fields") or {})
        if not changed:
            continue
        # These edits are the one provenance signal that cannot be
        # reconstructed later; record them in the same store.
        provenance.mark_edited(item, changed)
        # A human re-identified the item: the "match to review" flag is
        # answered, whichever way they decided.
        if changed & _IDENTITY_FIELDS and item.get(_SUSPECT_KEY):
            del item[_SUSPECT_KEY]
        item.store()
        try:
            item.write()
        except Exception as exc:
            protocol.log(f"library.update: tag write failed for {entry['id']}: {exc}")
        updated += 1
    return {"updated": updated}
