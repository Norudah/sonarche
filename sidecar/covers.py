"""An album's cover file, kept small enough to draw.

Each album has one picture, `cover.jpg` (beets' `artpath`), capped at
DISPLAY_MAX_PX: decoding a 5000 px cover costs ~100 MB of memory for a 40 px
thumbnail. Versions <= 2.x also archived a full-size `cover-hq.*`, whose
leftovers are still cleaned up.
"""

import os
import shutil

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
            try:
                shutil.move(scratch, art_path)
            except OSError:
                pass
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
