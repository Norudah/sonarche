"""Re-file the whole library under the current path templates.

One-shot, driven by the Rust host behind a marker (see `remux.rs`): when the
filing templates change between versions — the `Library/` + `Unidentified/`
zones — every file on disk still sits where the old templates put it, and
most of them would never be touched again. beets recomputes a destination
only when something moves, so the pass is exactly that: one `move()` per
album (album art rides along) and per rowless singleton, with a written-out
singleton cover (`sonarche_item_art`) carried by hand exactly as a real move
would. A rename on the same volume is cheap even at thousands of tracks, and
a file already in place is a no-op.

Legacy blank-titled rows — the old filing of guessed singles, whose folders
%aunique could only name by row id ("[86]") — dissolve instead of being
re-filed as "Library/Unknown Artist/Unknown Album": their items become
singletons again, and the provisional flag routes each one to the zone it
belongs to.

One failed move skips one record rather than sinking the pass; the marker is
the host's to write, and only on a completed run — an interrupted pass runs
again next launch and the no-ops cost nothing.
"""

import os

import protocol


def _follow_art(lib, item, old_art: str | None) -> None:
    import move_tracks

    if old_art:
        move_tracks._follow_item_art(lib, item, old_art)


def handle(request_id: str, params: dict) -> dict:
    # Same guard as every other launch-pass reader: a missing database means
    # first run or a just-erased library, and opening it here would create an
    # empty file every "does the user have a library" check then believes in.
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
