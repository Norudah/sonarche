"""Write the image an artist wears in the interface.

An artist is an entity nowhere — no beets table, no folder, no audio tag —
so the picture cannot live in the library. It lands in the app's own data
directory, and Rust indexes it in sonarche.db; this handler only turns the
user's file into the display rendition.

The pipeline is the cover one (`cover_set.prepare_cover`): same square crop,
same EXIF handling, same 500 px ceiling. What falls away is everything
album-shaped — no cover-hq archive (nothing will ever show an artist full
screen from here), no embedding (there is no file to embed into), no beets.
"""

import os

import cover_set
import protocol


def handle(_request_id: str, params: dict) -> dict:
    source_path = params["source_path"]
    dest_dir = params["dest_dir"]
    stem = params["stem"]
    if not os.path.isfile(source_path):
        raise RuntimeError(f"file not found: {source_path}")

    # The archive bytes are computed and dropped: prepare_cover decodes the
    # image either way, and sharing its crop rules matters more than the copy.
    _hq, thumb_bytes, is_png, side = cover_set.prepare_cover(source_path, params.get("crop"))

    filename = f"{stem}.{'png' if is_png else 'jpg'}"
    os.makedirs(dest_dir, exist_ok=True)
    with open(os.path.join(dest_dir, filename), "wb") as f:
        f.write(thumb_bytes)

    protocol.log(f"artist_image: wrote {filename} ({side}x{side} source square)")
    return {"filename": filename, "side": side}
