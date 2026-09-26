"""Album rows after enrichment: merging siblings into one row, and their covers."""

import os

import covers
import enrich
import protocol


def fetch_album_cover(
    album, items, release_id: str | None, release_group_id: str | None = None
) -> None:
    if not release_id:
        return
    try:
        protocol.log(f"enrich_album: fetching cover for release {release_id}")
        cover = enrich.download_cover(release_id, release_group_id)
        if cover is not None:
            enrich.set_album_art(album, *cover)
            for item in items:
                enrich.embed_cover(item, *cover)
            protocol.log(f"enrich_album: cover stored (500px embedded in {len(items)} file(s))")
    except Exception as exc:  # metadata landed; a missing cover is not a failure
        protocol.log(f"enrich_album: cover fetch failed: {exc}")


def _adopt_art(keep, dying) -> None:
    """Move a dying row's covers into the kept row's folder if it has none,
    otherwise delete them so the emptied folder can be pruned."""
    import shutil

    art = enrich._decode(dying.artpath) if dying.artpath else None
    if not art or not os.path.exists(art):
        return
    src_dir = os.path.dirname(art)
    covers = [art] + [
        os.path.join(src_dir, name)
        for name in os.listdir(src_dir)
        if name.startswith("cover-hq.")
    ]
    keep_art = enrich._decode(keep.artpath) if keep.artpath else None
    if keep_art and os.path.exists(keep_art):
        for path in covers:
            try:
                os.remove(path)
            except OSError as exc:
                protocol.log(f"enrich_album: stale cover removal failed: {exc}")
    else:
        dest_dir = enrich._decode(keep.item_dir())
        for path in covers:
            try:
                shutil.move(path, os.path.join(dest_dir, os.path.basename(path)))
            except OSError as exc:
                protocol.log(f"enrich_album: cover relocation failed: {exc}")
        keep.artpath = os.path.join(dest_dir, os.path.basename(art))
        keep["art_source"] = dying.get("art_source") or keep.get("art_source")
        keep.store()
    try:
        if not os.listdir(src_dir):
            os.rmdir(src_dir)
    except OSError:
        pass


def _merge_rows(lib, rows, label: str):
    """Merge sibling album rows into the fullest one and re-move its files.
    With a single row, the re-move only drops a stale %aunique suffix."""
    members = {row.id: list(row.items()) for row in rows}
    keep = max(rows, key=lambda row: (len(members[row.id]), -row.id))
    for row in rows:
        if row.id == keep.id:
            continue
        protocol.log(f"enrich_album: merging album row {row.id} into {keep.id} ({label})")
        for item in members[row.id]:
            item.album_id = keep.id
            item.store()
            members[keep.id].append(item)
        _adopt_art(keep, row)
        row.remove(delete=False, with_items=False)
    # %aunique memoizes per Library; reset it now the dead rows are gone.
    lib._memotable = {}
    art_dir_before = (
        os.path.dirname(enrich._decode(keep.artpath)) if keep.artpath else None
    )
    for item in members[keep.id]:
        try:
            item.move()
        except Exception as exc:
            protocol.log(f"enrich_album: move failed: {exc}")
    # Item.move never touches artpath.
    if members[keep.id]:
        try:
            keep.move_art()
            keep.store()
        except Exception as exc:
            protocol.log(f"enrich_album: art move failed: {exc}")
    _prune_vacated_art_dir(lib, keep, art_dir_before)
    return keep


def consolidate_album_rows(lib, items) -> list:
    """Keep one album row per MusicBrainz release and per album name.

    Sibling rows make %aunique suffix every folder while the UI, which groups by
    name, shows a single album. Collections and blank (provisional) names are
    left out."""
    import library as library_mod
    from beets.dbcore.query import AndQuery, MatchQuery

    def _fresh_rows():
        rows = {}
        for item in items:
            fresh = lib.get_item(item.id)
            if fresh is None or fresh.album_id is None:
                continue
            row = lib.get_album(fresh.album_id)
            if row is not None:
                rows[row.id] = row
        return list(rows.values())

    albums: dict[int, object] = {}
    touched_releases = {
        str(row.mb_albumid) for row in _fresh_rows() if row.mb_albumid
    }
    for release_id in touched_releases:
        rows = list(lib.albums(MatchQuery("mb_albumid", release_id)))
        if rows:
            keep = _merge_rows(lib, rows, release_id)
            albums[keep.id] = keep

    # Names on the post-merge state: this pass crosses editions, the first doesn't.
    touched_names = {
        (str(row.albumartist), str(row.album))
        for row in _fresh_rows()
        if row.albumartist
        and row.album
        and row.get(library_mod.ALBUM_KIND_KEY) != library_mod.COLLECTION
    }
    for albumartist, album_title in touched_names:
        rows = [
            row
            for row in lib.albums(
                AndQuery(
                    [MatchQuery("albumartist", albumartist), MatchQuery("album", album_title)]
                )
            )
            if row.get(library_mod.ALBUM_KIND_KEY) != library_mod.COLLECTION
        ]
        if not rows:
            continue
        if len(rows) == 1 and rows[0].id in albums:
            # Already merged and re-moved by the release pass.
            continue
        keep = _merge_rows(lib, rows, f"{albumartist} — {album_title}")
        for row in rows:
            albums.pop(row.id, None)
        albums[keep.id] = keep
    return list(albums.values())


def _prune_vacated_art_dir(lib, album, old_dir: str | None) -> None:
    """After a folder rename, sweep legacy covers and drop the emptied folder."""
    fresh = lib.get_album(album.id) if album is not None else None
    art = enrich._decode(fresh.artpath) if fresh is not None and fresh.artpath else None
    new_dir = os.path.dirname(art) if art else None
    if not old_dir or not new_dir or old_dir == new_dir or not os.path.isdir(old_dir):
        return
    covers.remove_legacy_archives(old_dir)
    try:
        if not os.listdir(old_dir):
            os.rmdir(old_dir)
    except OSError:
        pass


def embed_album_cover(album, item) -> None:
    """Copy the album's existing cover onto a provisionally-tagged track."""
    if album is None or not album.artpath:
        return
    path = enrich._decode(album.artpath)
    if not os.path.exists(path):
        return
    try:
        with open(path, "rb") as f:
            data = f.read()
        enrich.embed_cover(item, data, data[:4] == b"\x89PNG")
    except Exception as exc:
        protocol.log(f"enrich_album: cover embed failed: {exc}")
