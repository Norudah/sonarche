"""Refile tracks onto another album row: into an existing record, merging a
whole record, or gathering a selection into a new one (`new_album`).

Only filing fields change (`album`, `albumartist`, `comp`, optionally the
position); recording facts (`artist`, genre, year, `mb_trackid`) stay.

Every `album.store()` passes `inherit=False`: the default pushes dirty album
fields onto every item, which would blank each track's own MusicBrainz ids
when the new row's release identity is cleared.
"""

import os
import shutil

import library
import protocol
import provenance

# The source album's title, shown in the inspection views.
MOVED_FROM_KEY = "sonarche_moved_from"

# Release ids `lib.add_album` copies from the first item; a gathered record
# is no release, and scans keyed on `mb_albumid` must not treat it as one.
_RELEASE_IDENTITY_FIELDS = (
    "mb_albumid",
    "mb_releasegroupid",
    "mb_albumartistid",
    "albumtype",
    "albumtypes",
)


def renumbering(existing: list[int], count: int) -> list[int]:
    """Track numbers for `count` incoming tracks, after the highest existing one.
    Gaps are not refilled, so an existing order is never interleaved."""
    start = max((n for n in existing if n > 0), default=0)
    return list(range(start + 1, start + 1 + count))


def _decode(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def handle(_request_id: str, params: dict) -> dict:
    """Move items onto a target album row, existing or created.

    Params: `item_ids` (numbering order when `renumber` is on), exactly one of
    `target_album_id` / `new_album` ({"album", "albumartist"}), optional `kind`,
    and `renumber`.
    """
    db_path = params["beets_db"]
    if not os.path.exists(db_path):
        raise RuntimeError("library not found")

    item_ids = [int(value) for value in params.get("item_ids") or []]
    if not item_ids:
        raise RuntimeError("no tracks to move")

    target_album_id = params.get("target_album_id")
    new_album = params.get("new_album") or None
    if (target_album_id is None) == (new_album is None):
        raise RuntimeError("need exactly one of target_album_id and new_album")

    kind = params.get("kind") or None
    if kind is not None and kind not in ("album", library.COLLECTION):
        raise RuntimeError(f"unknown album kind: {kind}")

    from beets.library import Library

    lib = Library(db_path, directory=params["library_dir"])
    try:
        return _move(
            lib,
            item_ids,
            target_album_id,
            new_album,
            kind,
            renumber=bool(params.get("renumber")),
        )
    finally:
        lib._close()


def _move(lib, item_ids, target_album_id, new_album, kind, renumber) -> dict:
    items = []
    for item_id in item_ids:
        item = lib.get_item(item_id)
        if item is None:
            protocol.log(f"move_tracks: no item {item_id}, skipped")
            continue
        items.append(item)

    # Read up front: `lib.add_album` re-parents items in its own transaction.
    origins = {item.id: item.album_id for item in items}

    if target_album_id is not None:
        album = lib.get_album(int(target_album_id))
        if album is None:
            raise RuntimeError(f"album not found: id={target_album_id}")
        incoming = [item for item in items if item.album_id != album.id]
        # Residents in the selection would otherwise vote twice.
        owner_healed = _ensure_filed_owner(album, incoming)
        created = False
    else:
        incoming = items
        if not incoming:
            raise RuntimeError("no tracks to move")
        album = _create_album(lib, incoming, new_album)
        owner_healed = False
        created = True

    if renumber:
        existing = [] if created else [item.track or 0 for item in album.items()]
        numbers = renumbering(existing, len(incoming))

    # Retag and re-parent first (DB only), move files second: destinations must
    # be computed after the emptied source rows are gone, or %aunique suffixes
    # the target folder when a source shares its name.
    sources: dict[int, None] = {}
    for index, item in enumerate(incoming):
        changed: set[str] = set()
        old_album_title = (item.album or "").strip()
        origin = origins.get(item.id)
        if origin is not None and origin != album.id:
            sources.setdefault(origin, None)

        for key in ("album", "albumartist"):
            wanted = getattr(album, key) or ""
            if (getattr(item, key, "") or "") != wanted:
                setattr(item, key, wanted)
                changed.add(key)
        # `comp` selects the path template, so it must follow the record.
        if bool(item.comp) != bool(album.comp):
            item.comp = album.comp
            changed.add("comp")
        if renumber:
            if (item.track or 0) != numbers[index]:
                item.track = numbers[index]
                changed.add("track")
            # The old record's total no longer applies; 0 is beets' "unset".
            if (item.tracktotal or 0) != 0:
                item.tracktotal = 0
                changed.add("tracktotal")

        item.album_id = album.id
        if old_album_title and old_album_title != (album.album or ""):
            item[MOVED_FROM_KEY] = old_album_title
        if changed:
            # Treated like a manual edit, so bulk passes spare it.
            provenance.mark_edited(item, changed)

        item.store()

    # Drop emptied rows before computing destinations, but keep their covers on
    # disk until the audio has moved, in case the move fails midway.
    emptied_art: list[str | None] = []
    for source_id in sources:
        art = _pop_emptied_source(lib, source_id, album.id)
        if art is not False:
            emptied_art.append(art)
    sources_removed = len(emptied_art)
    # %aunique memoizes per Library; reset it now the dead rows are gone.
    lib._memotable = {}

    for item in incoming:
        old_art = item.get(library.ITEM_ART_KEY) or None
        # The album row itself is moved once below.
        item.try_sync(write=True, move=True, with_album=False)
        if old_art:
            _follow_item_art(lib, item, old_art)

    for art in emptied_art:
        _sweep_source_art(lib, art)

    # Re-file residents only when the album folder may have changed, so a
    # single-track move stays O(1).
    if sources_removed or owner_healed:
        resident_art = {
            item.id: item.get(library.ITEM_ART_KEY)
            for item in album.items()
            if item.get(library.ITEM_ART_KEY)
        }
        try:
            album.move()
        except Exception as exc:
            protocol.log(f"move_tracks: album re-file failed: {exc}")
        # Album.move doesn't carry a resident's singleton art.
        for item_id, old_art in resident_art.items():
            fresh = lib.get_item(item_id)
            if fresh is not None:
                _follow_item_art(lib, fresh, old_art)

    # Last, once every path has settled.
    covered = _adopt_album_art(lib, album, incoming)

    _apply_kind(album, kind)

    return {
        "moved": len(incoming),
        "covered": covered,
        "skipped": len(items) - len(incoming),
        "created": created,
        "target_album_id": album.id,
        "sources_removed": sources_removed,
    }


def _adopt_album_art(lib, album, incoming) -> int:
    """Embed the record's cover (its `artpath`) into the arrivals. Returns how
    many files took it. A record without a cover leaves the arrivals' own.

    A singleton cover (`sonarche_item_art`) becomes redundant and is removed.
    """
    art = _decode(album.artpath) if album.artpath else None
    if not art or not os.path.exists(art):
        return 0
    try:
        with open(art, "rb") as handle:
            data = handle.read()
    except OSError as exc:
        protocol.log(f"move_tracks: album cover unreadable ({exc}), arrivals keep theirs")
        return 0

    import enrich

    # The thumbnail-cover badge is per item; arrivals copy the residents' state.
    arriving = {item.id for item in incoming}
    provisional = any(
        item.get(library.PROVISIONAL_COVER_KEY)
        for item in album.items()
        if item.id not in arriving
    )

    covered = 0
    for item in incoming:
        fresh = lib.get_item(item.id)
        if fresh is None:
            continue
        if enrich.embed_cover(fresh, data, data[:4] == b"\x89PNG"):
            covered += 1
        _drop_item_art(fresh)
        if provisional and not fresh.get(library.PROVISIONAL_COVER_KEY):
            fresh[library.PROVISIONAL_COVER_KEY] = 1
            fresh.store()
        elif not provisional and fresh.get(library.PROVISIONAL_COVER_KEY):
            del fresh[library.PROVISIONAL_COVER_KEY]
            fresh.store()
    protocol.log(f"move_tracks: {covered} arrival(s) took the record's cover")
    return covered


def _drop_item_art(item) -> None:
    art = item.get(library.ITEM_ART_KEY)
    if not art:
        return
    try:
        if os.path.exists(art):
            os.remove(art)
    except OSError as exc:
        protocol.log(f"move_tracks: stale track cover removal failed: {exc}")
    del item[library.ITEM_ART_KEY]
    item.store()


def _ensure_filed_owner(album, arriving) -> bool:
    """Fill a blank album artist from the tracks in play (majority, then
    alphabetical) before arrivals inherit it. Returns whether it healed anything.

    A blank album artist makes the UI split the record into one card per track
    artist. Residents get the value explicitly: with `store(inherit=…)` their
    in-memory copies would undo it on the next sync."""
    if (str(album.albumartist) or "").strip():
        return False
    residents = list(album.items())
    counts: dict[str, int] = {}
    for item in residents + list(arriving):
        artist = (str(item.artist) or "").strip()
        if artist:
            counts[artist] = counts.get(artist, 0) + 1
    if not counts:
        return False
    owner = min(counts.items(), key=lambda pair: (-pair[1], pair[0]))[0]
    protocol.log(f"move_tracks: target row {album.id} had no album artist, filing under « {owner} »")
    album.albumartist = owner
    album.store(inherit=False)
    for item in residents:
        item.albumartist = owner
        item.try_sync(write=True, move=False, with_album=False)
    return True


def _create_album(lib, incoming, new_album) -> "object":
    """A fresh album row for a gathered record, with the release identity
    copied by `add_album` blanked (see `_RELEASE_IDENTITY_FIELDS`)."""
    title = str(new_album.get("album") or "").strip()
    artist = str(new_album.get("albumartist") or "").strip()
    if not title or not artist:
        raise RuntimeError("a new album needs a title and an artist")

    album = lib.add_album(incoming)
    album.album = title
    album.albumartist = artist
    album.comp = False
    for key in _RELEASE_IDENTITY_FIELDS:
        setattr(album, key, type(getattr(album, key))())
    album.store(inherit=False)
    return album


def _follow_item_art(lib, item, old_art: str) -> None:
    """Move a singleton's written-out cover along with its audio file."""
    new_art = os.path.splitext(_decode(item.path))[0] + os.path.splitext(old_art)[1]
    if old_art == new_art or not os.path.exists(old_art):
        return
    try:
        shutil.move(old_art, new_art)
    except OSError as exc:
        protocol.log(f"move_tracks: could not carry the cover of {item.id}: {exc}")
        return
    item[library.ITEM_ART_KEY] = new_art
    item.store()
    _prune_husk(lib, os.path.dirname(old_art))


def _pop_emptied_source(lib, source_id: int, target_id: int):
    """Drop a source album row its last track just left (row only).

    Returns the row's art path (or None) for `_sweep_source_art`, or False when
    there was nothing to drop.
    """
    if source_id == target_id:
        return False
    source = lib.get_album(source_id)
    if source is None:
        return False
    if list(source.items()):
        return False

    art = _decode(source.artpath) if source.artpath else None
    source.remove(delete=False, with_items=False)
    return art


def _sweep_source_art(lib, art: str | None) -> None:
    """Delete an emptied source's cover, then prune its folder."""
    if not art:
        return
    try:
        if os.path.exists(art):
            os.remove(art)
    except OSError as exc:
        protocol.log(f"move_tracks: source cover removal failed: {exc}")
    _prune_husk(lib, os.path.dirname(art))


def _prune_husk(lib, directory: str | None) -> None:
    """Remove legacy `cover-hq.*` files, then let beets prune empty folders."""
    if not directory or not os.path.isdir(directory):
        return
    import covers
    from beets import util

    covers.remove_legacy_archives(directory)
    util.prune_dirs(directory, lib.directory)


def _apply_kind(album, kind: str | None) -> None:
    """Set the target's kind when asked. As in `album_kind.py`, "album" is the
    absence of the attribute."""
    if kind is None:
        return
    if kind == library.COLLECTION:
        if album.get(library.ALBUM_KIND_KEY) != library.COLLECTION:
            album[library.ALBUM_KIND_KEY] = library.COLLECTION
            album.store(inherit=False)
        return
    try:
        del album[library.ALBUM_KIND_KEY]
    except KeyError:
        return
    album.store(inherit=False)
