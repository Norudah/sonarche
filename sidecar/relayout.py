"""Re-file the whole library under the current path templates.

One-shot, run by the host behind a marker when templates change. beets only
recomputes destinations on move, so this moves every album and rowless
singleton (carrying singleton covers by hand); in-place files are no-ops.

Legacy blank-titled rows are dissolved: their items become singletons and
the provisional flag routes them. A failed move skips one record; the host
writes the marker only after a complete run.
"""

import os

import protocol


def _follow_art(lib, item, old_art: str | None) -> None:
    import move_tracks

    if old_art:
        move_tracks._follow_item_art(lib, item, old_art)


def handle(request_id: str, params: dict) -> dict:
    # Opening a missing DB would create an empty one.
    if not os.path.exists(params["beets_db"]):
        return {"albums": 0, "singles": 0, "dissolved": 0}

    import enrich
    import library as library_mod
    from beets.library import Library

    lib = Library(params["beets_db"], directory=params["library_dir"])
    albums = singles = dissolved = 0

    for album in list(lib.albums()):
        if (str(album.album) or "").strip():
            continue
        for item in album.items():
            item.album_id = None
            item.store()
        enrich.drop_emptied_row(lib, album)
        dissolved += 1
    if dissolved:
        protocol.log(f"relayout: dissolved {dissolved} blank album row(s)")

    for album in lib.albums():
        arts = {
            item.id: item.get(library_mod.ITEM_ART_KEY)
            for item in album.items()
            if item.get(library_mod.ITEM_ART_KEY)
        }
        try:
            album.move()
            albums += 1
        except Exception as exc:  # one stuck record must not sink the pass
            protocol.log(f"relayout: album {album.id} move failed: {exc}")
            continue
        for item_id, old_art in arts.items():
            fresh = lib.get_item(item_id)
            if fresh is not None:
                _follow_art(lib, fresh, old_art)

    for item in lib.items():
        if item.album_id is not None:
            continue
        old_art = item.get(library_mod.ITEM_ART_KEY) or None
        try:
            item.move()
            singles += 1
        except Exception as exc:
            protocol.log(f"relayout: item {item.id} move failed: {exc}")
            continue
        _follow_art(lib, item, old_art)

    protocol.log(
        f"relayout: re-filed {albums} album(s), {singles} singleton(s), "
        f"{dissolved} blank row(s) dissolved"
    )
    return {"albums": albums, "singles": singles, "dissolved": dissolved}
