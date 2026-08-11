"""Refile tracks onto another record — the verb behind "my own album".

Plenty of people do not keep releases: they keep four tracks of an artist they
actually like, filed under a record they named themselves. Sonarche's write
path cannot say that — `library.update` treats an album edit as a *rename* (set
the value on the album row, re-sync every track), so editing three tracks out
of twelve renames all twelve. Moving some tracks somewhere else is a different
verb, and this is it.

One operation covers every gesture: move a track into an existing record, merge
a whole record into another, or gather a selection into a brand-new one
(`new_album`). What changes on the moved items is exactly what decides where a
file is *filed* — `album`, `albumartist`, and (on request) the position — and
nothing that states a fact about the recording: `artist`, genre, year and
`mb_trackid` stay, which is the whole point of a personal gathering.

Two things the album row writes here must never do, and why `inherit=False` is
load-bearing on every `album.store()`: beets' default `store(inherit=True)`
pushes dirty album fields — flexible attributes included — down onto every
item, so blanking the created row's release identity would blank each track's
own MusicBrainz match with it.

An emptied source row is removed and its folder cleaned by hand: beets prunes a
vacated directory only when nothing is left in it, and its own `cover.jpg`
(plus our `cover-hq.*` archive) is still there, so the husk would outlive the
record it belonged to.
"""

import os
import shutil

import library
import protocol
import provenance

# Where a moved track came from (the source album's title), on the item. The
# inspection surfaces read it ("vient de X"); nothing structural depends on it
# — undo is just the same verb pointed back.
MOVED_FROM_KEY = "sonarche_moved_from"

# Release identity fields `lib.add_album` copies from the first item onto a
# brand-new row. A gathered record is nobody's release: left in place they
# would claim the row *is* the first track's album of origin, and every scan
# keyed on `mb_albumid` (alignment, enrich) would treat it as one.
_RELEASE_IDENTITY_FIELDS = (
    "mb_albumid",
    "mb_releasegroupid",
    "mb_albumartistid",
    "albumtype",
    "albumtypes",
)


def renumbering(existing: list[int], count: int) -> list[int]:
    """Track numbers for `count` incoming tracks, stacked after what is there.

    Gaps in the existing numbering are not refilled: the numbers already on the
    record are its owner's (or a release's) and re-using a hole would silently
    interleave new tracks into an order someone chose. Pure.
    """
    start = max((n for n in existing if n > 0), default=0)
    return list(range(start + 1, start + 1 + count))


def _decode(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def handle(_request_id: str, params: dict) -> dict:
    """Move items onto a target album row, existing or created.

    Params: `item_ids` (order = numbering order when `renumber` is on), exactly
    one of `target_album_id` / `new_album` ({"album", "albumartist"}), optional
    `kind` to declare the target's nature in the same pass, and `renumber`.
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

    if target_album_id is not None:
        album = lib.get_album(int(target_album_id))
        if album is None:
            raise RuntimeError(f"album not found: id={target_album_id}")
        # Already filed there: nothing to do, and counting them as moved would
        # make the recap lie.
        incoming = [item for item in items if item.album_id != album.id]
        created = False
    else:
        incoming = items
        if not incoming:
            raise RuntimeError("no tracks to move")
        album = _create_album(lib, incoming, new_album)
        created = True

    if renumber:
        # For an existing target the base is what it holds *now* — the incoming
        # items have not moved yet, so `album.items()` is exactly the residents.
        existing = [] if created else [item.track or 0 for item in album.items()]
        numbers = renumbering(existing, len(incoming))

    sources: dict[int, None] = {}
    for index, item in enumerate(incoming):
        changed: set[str] = set()
        old_album_title = (item.album or "").strip()
        if item.album_id is not None and item.album_id != album.id:
            sources.setdefault(item.album_id, None)

        for key in ("album", "albumartist"):
            wanted = getattr(album, key) or ""
            if (getattr(item, key, "") or "") != wanted:
                setattr(item, key, wanted)
                changed.add(key)
        if renumber:
            if (item.track or 0) != numbers[index]:
                item.track = numbers[index]
                changed.add("track")
            # The old record's total is a statement about a tracklist this
            # track no longer sits on; 0 is beets' "unset".
            if (item.tracktotal or 0) != 0:
                item.tracktotal = 0
                changed.add("tracktotal")

        item.album_id = album.id
        if old_album_title and old_album_title != (album.album or ""):
            item[MOVED_FROM_KEY] = old_album_title
        if changed:
            # The destination is the user's word: a later bulk pass must spare
            # it exactly like a typed-in edit.
            provenance.mark_edited(item, changed)

        old_art = item.get(library.ITEM_ART_KEY) or None
        # `with_album=False`: the target row is not moving, so giving it "a
        # chance to move its art" per incoming track is N no-op stats at best.
        item.try_sync(write=True, move=True, with_album=False)
        if old_art:
            _follow_item_art(lib, item, old_art)

    sources_removed = sum(
        1 for source_id in sources if _remove_emptied_source(lib, source_id, album.id)
    )
    _apply_kind(album, kind)

    return {
        "moved": len(incoming),
        "skipped": len(items) - len(incoming),
        "created": created,
        "target_album_id": album.id,
        "sources_removed": sources_removed,
    }


def _create_album(lib, incoming, new_album) -> "object":
    """A fresh album row for a gathered record.

    `add_album` builds the row out of the first item's album-level fields and
    re-parents the items in one transaction; what it copied that states a
    release identity is then blanked — see `_RELEASE_IDENTITY_FIELDS`.
    """
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
    """Bring a singleton's written-out cover along with its file.

    The picture was extracted beside the audio at import (`sonarche_item_art`),
    so a moved file leaves it stranded in a folder about to be pruned — and the
    attribute pointing at it stale. Same sibling naming as the writer.
    """
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


def _remove_emptied_source(lib, source_id: int, target_id: int) -> bool:
    """Drop a source album row its last track just left, and its folder.

    beets pruned the vacated directory only if nothing was left in it; the
    album's own `cover.jpg` and our `cover-hq.*` archive usually are, so both
    are removed by hand before pruning. A source still holding tracks is left
    entirely alone — it is still a record.
    """
    if source_id == target_id:
        return False
    source = lib.get_album(source_id)
    if source is None:
        return False
    if list(source.items()):
        return False

    art_dir = os.path.dirname(_decode(source.artpath)) if source.artpath else None
    # `delete=True` with `with_items=False` deletes exactly one thing: the art
    # file. The items are gone already — that is why we are here.
    source.remove(delete=True, with_items=False)
    if art_dir:
        _prune_husk(lib, art_dir)
    return True


def _prune_husk(lib, directory: str | None) -> None:
    """Remove our `cover-hq.*` leftovers, then let beets prune what is empty."""
    if not directory or not os.path.isdir(directory):
        return
    import covers
    from beets import util

    for name in os.listdir(directory):
        if name.startswith(covers.HQ_PREFIX):
            try:
                os.remove(os.path.join(directory, name))
            except OSError as exc:
                protocol.log(f"move_tracks: could not remove {name}: {exc}")
    util.prune_dirs(directory, lib.directory)


def _apply_kind(album, kind: str | None) -> None:
    """Declare the target's nature in the same pass, when asked to.

    Same semantics as `album_kind.py`: collection is stored, album is the
    absence of the attribute — a row stating the default outlives its meaning.
    """
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
