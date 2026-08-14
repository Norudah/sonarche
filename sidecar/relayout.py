"""Re-file the whole library under the current path templates.

One-shot, driven by the Rust host behind a marker (see `remux.rs`): when the
filing templates change between versions — the `Library/` + `Unidentified/`
zones — every file on disk still sits where the old templates put it, and
most of them would never be touched again. beets recomputes a destination
only when something moves, so the pass is exactly that: one `move()` per
album (art rides along) and per rowless singleton. A rename on the same
volume is cheap even at thousands of tracks, and a file already in place is
a no-op.

One failed move skips one record rather than sinking the pass; the marker is
the host's to write, and only on a completed run — an interrupted pass runs
again next launch and the no-ops cost nothing.
"""

import protocol


def handle(request_id: str, params: dict) -> dict:
    from beets.library import Library

    lib = Library(params["beets_db"], directory=params["library_dir"])
    albums = singles = 0
    for album in lib.albums():
        try:
            album.move()
            albums += 1
        except Exception as exc:  # one stuck record must not sink the pass
            protocol.log(f"relayout: album {album.id} move failed: {exc}")
    for item in lib.items():
        if item.album_id is not None:
            continue
        try:
            item.move()
            singles += 1
        except Exception as exc:
            protocol.log(f"relayout: item {item.id} move failed: {exc}")
    protocol.log(f"relayout: re-filed {albums} album(s), {singles} singleton(s)")
    return {"albums": albums, "singles": singles}
