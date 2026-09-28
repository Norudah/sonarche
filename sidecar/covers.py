"""An album's cover file, kept small enough to draw.

Each album has one picture, `cover.jpg` (beets' `artpath`), capped at
DISPLAY_MAX_PX: decoding a 5000 px cover costs ~100 MB of memory for a 40 px
thumbnail. Versions <= 2.x also archived a full-size `cover-hq.*`, whose
leftovers are still cleaned up.
"""

import contextlib
import os
import shutil
import tempfile

import beets_paths
import protocol

# Only referenced to remove leftovers from <= 2.x.
HQ_PREFIX = "cover-hq."

# Same size the download path writes.
DISPLAY_MAX_PX = 500


def needs_rendition(width: int, height: int) -> bool:
    """Whether the longest side exceeds the display ceiling."""
    return max(width, height) > DISPLAY_MAX_PX


def read_dimensions(path: str) -> tuple[int, int] | None:
    """Pixel size of an image, or None. `Image.open` only parses the header."""
    from PIL import Image

    try:
        with Image.open(path) as image:
            return image.size
    except (OSError, ValueError) as exc:
        protocol.log(f"covers: cannot measure {path}: {exc}")
        return None


def _write_rendition(source: str, dest: str) -> None:
    """Scale `source` to fit DISPLAY_MAX_PX and write it to `dest`.

    The format follows the source, not `dest`'s extension: `dest` is beets'
    `artpath` and must keep matching its real format.
    """
    from PIL import Image

    with Image.open(source) as image:
        fmt = image.format
        image.thumbnail((DISPLAY_MAX_PX, DISPLAY_MAX_PX))
        # JPEG supports neither alpha nor palettes.
        if fmt == "JPEG" and image.mode not in ("RGB", "L", "CMYK"):
            image = image.convert("RGB")
        image.save(dest, format=fmt)


def ensure_display_rendition(art_path: str) -> bool:
    """Replace an oversized cover in place with a rendition, so `artpath` stays
    valid. Returns whether a rendition was made. Imports copy, so the user's own
    file is never the one shrunk.
    """
    if not art_path or not os.path.exists(art_path):
        return False

    size = read_dimensions(art_path)
    if size is None or not needs_rendition(*size):
        return False

    # A scratch copy keeps the original if the resize dies half-way.
    scratch = f"{art_path}.sonarche-original"
    try:
        shutil.copyfile(art_path, scratch)
        _write_rendition(scratch, art_path)
    except (OSError, ValueError) as exc:
        protocol.log(f"covers: rendition failed for {art_path}: {exc}")
        if os.path.exists(scratch) and not os.path.exists(art_path):
            with contextlib.suppress(OSError):
                shutil.move(scratch, art_path)
        _discard(scratch)
        return False

    _discard(scratch)
    return True


def _discard(path: str) -> None:
    """Remove a working copy; failure is only logged."""
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        pass


def remove_legacy_archives(art_dir: str) -> int:
    """Delete the <= 2.x `cover-hq.*` files in one folder. Returns the count."""
    try:
        names = os.listdir(art_dir)
    except OSError:
        return 0
    removed = 0
    for name in names:
        if name.startswith(HQ_PREFIX):
            try:
                os.remove(os.path.join(art_dir, name))
                removed += 1
            except OSError as exc:
                protocol.log(f"covers: could not remove legacy archive {name}: {exc}")
    return removed


def caa_front(entity_path: str) -> tuple[bytes, bool] | None:
    """The 500px front cover of a CAA entity (`release/<id>` or
    `release-group/<id>`) as (data, is_png), or None. Falls back to the full
    upload when no rendition exists; `set_album_art` shrinks it."""
    import requests

    import cover_set
    import net

    for variant in ("front-500", "front"):
        resp = requests.get(
            f"https://coverartarchive.org/{entity_path}/{variant}", timeout=30, stream=True
        )
        if resp.status_code != 200:
            continue
        try:
            data = net.read_bounded(resp, cover_set.MAX_CANDIDATE_BYTES)
        except RuntimeError:
            protocol.log(f"covers: cover on {entity_path}/{variant} over the size cap, skipped")
            continue
        if data:
            return data, data[:4] == b"\x89PNG"
    return None


def download_cover(
    release_id: str, release_group_id: str | None = None
) -> tuple[bytes, bool] | None:
    """The 500px display cover from the Cover Art Archive, or None.

    Falls back to the release-group cover: many regional or streaming releases
    carry no art of their own."""
    cover = caa_front(f"release/{release_id}")
    if cover is not None:
        return cover
    protocol.log(f"covers: no per-release cover for {release_id}")
    if release_group_id:
        cover = caa_front(f"release-group/{release_group_id}")
        if cover is not None:
            protocol.log(f"covers: cover found on release-group {release_group_id}")
            return cover
        protocol.log(f"covers: no cover on release-group {release_group_id} either")
    return None


def set_album_art(album, data: bytes, is_png: bool, source: str = "Cover Art Archive") -> None:
    """Set beets' artpath (cover.jpg). `source` records the picture's origin."""
    with tempfile.NamedTemporaryFile(suffix=".png" if is_png else ".jpg", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        album.set_art(tmp_path, copy=True)
        album["art_source"] = source
        album.store()
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
    # The CAA fallback may hand over a full-size upload.
    if album.artpath:
        ensure_display_rendition(beets_paths.decode(album.artpath))


def embed_cover(item, data: bytes, is_png: bool) -> bool:
    """Embed the cover into the audio file. Returns whether it worked.

    Uses `mediafile` so every container (m4a, mp3, flac) is supported."""
    import mediafile

    path = beets_paths.item_path(item)
    if not os.path.exists(path):
        return False
    try:
        media = mediafile.MediaFile(path)
        media.images = [mediafile.Image(data=data, desc="", type=mediafile.ImageType.front)]
        media.save()
    except (mediafile.UnreadableFileError, OSError, ValueError) as exc:
        # A cover is never worth failing an enrich, move or conversion.
        protocol.log(f"covers: cover embed failed for {path}: {exc}")
        return False
    return True
