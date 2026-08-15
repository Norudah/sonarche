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
import tempfile

import cover_set
import net
import protocol

# A pasted link is a one-off personal fetch, not a service integration: the
# user chooses the source, the app only executes the click — the same act as
# a browser's "save image as". Bound what one paste may pull.
MAX_FETCH_BYTES = 30 * 1024 * 1024


def sniff_suffix(data: bytes) -> str | None:
    """The file suffix the bytes actually are, or None when they are not an
    image we handle. Trusting magic bytes over the URL or Content-Type: a
    hotlink-protection page arrives as 200 text/html, and an extensionless
    CDN URL says nothing."""
    if data[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


def fetch(_request_id: str, params: dict) -> dict:
    """Download a pasted image URL into a temp file the picker then adopts
    exactly like a local pick — one pipeline downstream, crop included."""
    url = params["url"]
    if not url.startswith("https://"):
        raise RuntimeError("only https links are accepted")

    import requests

    resp = requests.get(url, timeout=30, stream=True)
    if resp.status_code != 200:
        raise RuntimeError(f"image download failed ({resp.status_code})")
    # requests follows redirects across schemes: the pasted https link must
    # not have been walked down to plain http behind the user's back.
    if not resp.url.startswith("https://"):
        raise RuntimeError("the link redirected away from https")
    data = net.read_bounded(resp, MAX_FETCH_BYTES)
    if not data:
        raise RuntimeError("image download failed (empty)")
    suffix = sniff_suffix(data)
    if suffix is None:
        raise RuntimeError("the link did not return an image")

    # The prefix marks the file as ours: a stale one (the modal was closed
    # without confirming) is swept by the app at the next launch.
    with tempfile.NamedTemporaryFile(prefix="sonarche-fetch-", suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    protocol.log(f"artist_image: fetched {len(data)} bytes into {tmp_path}")
    return {"path": tmp_path, "bytes": len(data)}


def handle(_request_id: str, params: dict) -> dict:
    source_path = params["source_path"]
    dest_dir = params["dest_dir"]
    stem = params["stem"]
    if not os.path.isfile(source_path):
        raise RuntimeError(f"file not found: {source_path}")

    thumb_bytes, is_png, side = cover_set.prepare_cover(source_path, params.get("crop"))

    filename = f"{stem}.{'png' if is_png else 'jpg'}"
    os.makedirs(dest_dir, exist_ok=True)
    with open(os.path.join(dest_dir, filename), "wb") as f:
        f.write(thumb_bytes)

    protocol.log(f"artist_image: wrote {filename} ({side}x{side} source square)")
    return {"filename": filename, "side": side}
