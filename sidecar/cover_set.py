"""Replace an album's cover with a user-picked image (local file or CAA).

The image is cropped square, scaled to a 500 px rendition, written as beets'
`artpath` and embedded into the album's files. The user's file is only read.
Crop coordinates apply after EXIF orientation, as the browser displays it.
"""

from __future__ import annotations

import base64
import io
import os
import tempfile
from typing import TYPE_CHECKING

# PIL is imported lazily to keep sidecar startup light.
if TYPE_CHECKING:
    from PIL import Image

import covers
import net
import protocol

# Refuses sources that would balloon memory when decoded.
MAX_SOURCE_PX = 12_000

ART_SOURCE = "Local file"
CAA_ART_SOURCE = "Cover Art Archive"

_PROVISIONAL_COVER_KEY = "sonarche_provisional_cover"

CAA_ROOT = "https://coverartarchive.org"

# Thumbnails ship as data URLs (the CSP allows no remote images).
MAX_CANDIDATES = 8

# CAA uploads can be full-resolution scans.
MAX_CANDIDATE_BYTES = 60 * 1024 * 1024


def square_crop_box(width: int, height: int, crop: dict | None) -> tuple[int, int, int]:
    """The (left, top, size) square cut from a width x height image.

    A requested crop is clamped into the frame, since it comes from a scaled
    preview and may drift by a pixel. No crop means the centered square.
    """
    max_size = min(width, height)
    if crop is None:
        size = max_size
    else:
        size = min(int(crop.get("size", max_size)), max_size)
        size = max(size, 1)
    if crop is None:
        left = (width - size) // 2
        top = (height - size) // 2
    else:
        left = min(max(int(crop.get("left", 0)), 0), width - size)
        top = min(max(int(crop.get("top", 0)), 0), height - size)
    return left, top, size


def _encode(image: Image.Image, is_png: bool) -> bytes:
    buffer = io.BytesIO()
    if is_png:
        image.save(buffer, format="PNG")
    else:
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        # The library keeps only this copy, and embeds it everywhere.
        image.save(buffer, format="JPEG", quality=92)
    return buffer.getvalue()


def prepare_cover(source_path: str, crop: dict | None) -> tuple[bytes, bool, int]:
    """(thumb_bytes, is_png, side): the cropped square scaled to the display
    size. `side` is the square's size in source pixels."""
    from PIL import Image, ImageOps

    with Image.open(source_path) as opened:
        source_format = opened.format
        oriented = ImageOps.exif_transpose(opened)
        width, height = oriented.size
        if max(width, height) > MAX_SOURCE_PX:
            raise RuntimeError(f"image too large: {width}x{height} (max {MAX_SOURCE_PX} px per side)")

        left, top, size = square_crop_box(width, height, crop)
        square = oriented.crop((left, top, left + size, top + size))

        is_png = source_format == "PNG"
        thumb = square.copy()
        thumb.thumbnail((covers.DISPLAY_MAX_PX, covers.DISPLAY_MAX_PX))
        thumb_bytes = _encode(thumb, is_png)

    return thumb_bytes, is_png, size


def _clear_stale_art(album, old_art: str | None, decode) -> None:
    """Remove legacy cover-hq.* files and an old artpath left by a format change."""
    new_art = decode(album.artpath) if album.artpath else None
    if not new_art:
        return
    covers.remove_legacy_archives(os.path.dirname(new_art))
    if old_art and old_art != new_art and os.path.exists(old_art):
        try:
            os.remove(old_art)
        except OSError as exc:
            protocol.log(f"cover_set: could not remove old art {old_art}: {exc}")


def _caa_index(entity_path: str) -> list[dict] | None:
    import requests

    resp = requests.get(f"{CAA_ROOT}/{entity_path}", timeout=30, headers={"Accept": "application/json"})
    if resp.status_code != 200:
        return None
    try:
        images = resp.json().get("images")
    except ValueError:
        return None
    return images or None


def _thumb_data_url(url: str) -> str | None:
    """A candidate's thumbnail as a data URL (the CSP allows no remote images)."""
    import requests

    try:
        resp = requests.get(url, timeout=30)
    except requests.RequestException as exc:
        protocol.log(f"cover_set: thumbnail fetch failed: {exc}")
        return None
    if resp.status_code != 200 or not resp.content:
        return None
    mime = "image/png" if resp.content[:4] == b"\x89PNG" else "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(resp.content).decode('ascii')}"


def candidates(_request_id: str, params: dict) -> dict:
    """The album's Cover Art Archive images: fronts first, the release, then
    its release-group."""
    from beets.library import Library

    lib = Library(params["beets_db"], directory=params["library_dir"])
    album = lib.get_album(params["album_id"])
    if album is None:
        raise RuntimeError(f"album not found: {params['album_id']}")

    images = None
    release_id = album.get("mb_albumid")
    group_id = album.get("mb_releasegroupid")
    if release_id:
        images = _caa_index(f"release/{release_id}")
    if not images and group_id:
        images = _caa_index(f"release-group/{group_id}")
    if not images:
        return {"candidates": []}

    return {"candidates": shape_candidates(images, _thumb_data_url)}


def _https(url: str | None) -> str | None:
    """Upgrade CAA's http:// URLs: the IPC validators only accept
    https://coverartarchive.org."""
    if url and url.startswith("http://"):
        return "https://" + url[len("http://") :]
    return url


def shape_candidates(images: list[dict], fetch_thumb) -> list[dict]:
    """CAA index entries -> wire shape: fronts first, capped, undrawable ones
    dropped."""
    ordered = sorted(images, key=lambda image: not image.get("front"))[:MAX_CANDIDATES]
    out = []
    for image in ordered:
        thumbs = image.get("thumbnails") or {}
        thumb_url = _https(thumbs.get("250") or thumbs.get("small") or image.get("image"))
        full_url = _https(image.get("image"))
        if not thumb_url or not full_url:
            continue
        thumb = fetch_thumb(thumb_url)
        if thumb is None:
            continue
        out.append(
            {
                "id": str(image.get("id")),
                "thumb": thumb,
                "image_url": full_url,
                "front": bool(image.get("front")),
                "types": image.get("types") or [],
            }
        )
    return out


def _download_candidate(url: str) -> bytes:
    """The chosen upload at full size."""
    import requests

    if not url.startswith(f"{CAA_ROOT}/"):
        raise RuntimeError("candidate URL outside the Cover Art Archive")
    resp = requests.get(url, timeout=60, stream=True)
    if resp.status_code != 200:
        raise RuntimeError(f"cover download failed ({resp.status_code})")
    data = net.read_bounded(resp, MAX_CANDIDATE_BYTES)
    if not data:
        raise RuntimeError("cover download failed (empty)")
    return data


def handle(_request_id: str, params: dict) -> dict:
    from beets.library import Library

    import enrich

    source_path = params.get("source_path")
    image_url = params.get("image_url")
    if bool(source_path) == bool(image_url):
        raise RuntimeError("exactly one of source_path / image_url is required")
    if source_path and not os.path.isfile(source_path):
        raise RuntimeError(f"file not found: {source_path}")

    lib = Library(params["beets_db"], directory=params["library_dir"])
    album = lib.get_album(params["album_id"])
    if album is None:
        raise RuntimeError(f"album not found: {params['album_id']}")

    def decode(raw) -> str:
        return raw.decode("utf-8", "surrogateescape") if isinstance(raw, bytes) else raw

    if image_url:
        # Through a temp file so both sources share the local-file path.
        data = _download_candidate(image_url)
        suffix = ".png" if data[:4] == b"\x89PNG" else ".jpg"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            thumb_bytes, is_png, side = prepare_cover(tmp_path, None)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        art_source = CAA_ART_SOURCE
    else:
        thumb_bytes, is_png, side = prepare_cover(source_path, params.get("crop"))
        art_source = ART_SOURCE

    old_art = decode(album.artpath) if album.artpath else None
    enrich.set_album_art(album, thumb_bytes, is_png, source=art_source)
    _clear_stale_art(album, old_art, decode)

    embedded = 0
    for item in album.items():
        if enrich.embed_cover(item, thumb_bytes, is_png):
            embedded += 1
        # A user-chosen cover is real art: lift the placeholder flag.
        if item.get(_PROVISIONAL_COVER_KEY):
            del item[_PROVISIONAL_COVER_KEY]
            item.store()

    art_path = decode(album.artpath) if album.artpath else None
    protocol.log(f"cover_set: album {album.id} now carries {art_path} (cut at {side}x{side})")
    return {"art_path": art_path, "side": side, "embedded": embedded}
