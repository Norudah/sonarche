"""Prepare an artist image from a user file or a pasted URL.

Artists exist nowhere in beets, so the image lives in the app's data folder
(indexed by Rust in sonarche.db). Same crop and 500 px rendition as covers
(`cover_set.prepare_cover`), without embedding.
"""

import os
import tempfile

import cover_set
import net
import protocol

# Bounds what one pasted link may pull.
MAX_FETCH_BYTES = 30 * 1024 * 1024


def sniff_suffix(data: bytes) -> str | None:
    """The file suffix from the image's magic bytes, or None. The URL and
    Content-Type are unreliable (hotlink pages, extensionless CDN URLs)."""
    if data[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


def fetch(_request_id: str, params: dict) -> dict:
    """Download a pasted image URL into a temp file, then handled like a local pick."""
    url = params["url"]
    if not url.startswith("https://"):
        raise RuntimeError("only https links are accepted")

    import requests

    resp = requests.get(url, timeout=30, stream=True)
    if resp.status_code != 200:
        raise RuntimeError(f"image download failed ({resp.status_code})")
    # requests follows redirects across schemes; refuse a downgrade to http.
    if not resp.url.startswith("https://"):
        raise RuntimeError("the link redirected away from https")
    data = net.read_bounded(resp, MAX_FETCH_BYTES)
    if not data:
        raise RuntimeError("image download failed (empty)")
    suffix = sniff_suffix(data)
    if suffix is None:
        raise RuntimeError("the link did not return an image")

    # The prefix lets the app sweep stale files at next launch.
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
