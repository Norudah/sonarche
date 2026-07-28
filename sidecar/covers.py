"""The two cover files of an album, and keeping them together.

An album carries `cover.jpg` — beets' own `artpath`, the rendition the
interface draws — and, beside it, `cover-hq.*`: the full-size original,
archived out of beets' sight for the day a full-size view exists. The second
one is ours, so beets never moves it, never prunes it and never knows it is
there. Every operation that relocates an album has to bring it along by hand.

Why two files at all: an image on disk is compressed, but drawing it means
decompressing it into pixels, and that costs width x height x 4 bytes however
small the file is. A 5000x5000 cover is 100 MB of memory to paint a 40 px
thumbnail, against 1 MB for a 500 px one. The rendition exists so nothing on
screen ever pays that.
"""

import os
import shutil

from PIL import Image

import protocol

HQ_PREFIX = "cover-hq."

# The longest side a cover may have once the interface reads it. Matches the
# rendition the download path already writes, so an imported album and a
# downloaded one cost the same to draw.
DISPLAY_MAX_PX = 500

# Pillow, not `sips`: the resize used to shell out to a macOS-only binary, which
# was the sidecar's last tie to one OS. Reading the size is also a header read
# now instead of a process spawn, which matters — the import sweep asks the
# question once per album and answers "already small enough" almost every time.


def hq_name_for(art_name: str) -> str:
    """Where the full-size original goes, given beets' own art filename.

    The extension is carried over rather than forced to `.jpg`: the archive is
    a copy of the file the user had, and re-labelling a PNG as JPEG would make
    every later reader guess wrong.
    """
    _, ext = os.path.splitext(art_name)
    return f"{HQ_PREFIX}{ext.lstrip('.').lower() or 'jpg'}"


def needs_rendition(width: int, height: int) -> bool:
    """Whether this cover is too big to be drawn as-is.

    Judged on the longest side, which is what the rendition scales. Equal is
    fine: a cover already at the ceiling is the rendition.
    """
    return max(width, height) > DISPLAY_MAX_PX


def read_dimensions(path: str) -> tuple[int, int] | None:
    """Pixel size of an image, or None when it cannot be read.

    `Image.open` is lazy — it parses the header and stops — so this never
    decodes the pixels it exists to avoid decoding.
    """
    try:
        with Image.open(path) as image:
            return image.size
    except (OSError, ValueError) as exc:
        protocol.log(f"covers: cannot measure {path}: {exc}")
        return None


def _write_rendition(source: str, dest: str) -> None:
    """Scale `source` down to fit DISPLAY_MAX_PX and write it to `dest`.

    The format is carried over from the source rather than inferred from the
    destination's extension: `dest` is beets' own `artpath`, and a PNG rewritten
    as JPEG under a `.png` name is a file every later reader gets wrong.

    `thumbnail` fits the image inside the box and keeps the aspect ratio, which
    is what `sips -Z` did. Its in-place resize is also why the source is opened
    and the result written in one breath — the object it mutates is the decoded
    image, and the point is to hold it for as short a time as possible.
    """
    with Image.open(source) as image:
        fmt = image.format
        image.thumbnail((DISPLAY_MAX_PX, DISPLAY_MAX_PX))
        # JPEG holds neither alpha nor a palette, and Pillow raises rather than
        # guessing. Everything else round-trips as-is.
        if fmt == "JPEG" and image.mode not in ("RGB", "L", "CMYK"):
            image = image.convert("RGB")
        image.save(dest, format=fmt)


def ensure_display_rendition(art_path: str) -> bool:
    """Make sure the file the interface reads is small enough to draw.

    An oversized cover is archived as `cover-hq.*` and replaced, at its own
    path, by a rendition — so beets' `artpath` stays valid and nothing else has
    to learn about the swap. Returns whether a rendition was made.

    Never destructive: the original survives under the archive name, which is
    the whole point of keeping two files rather than shrinking one.
    """
    if not art_path or not os.path.exists(art_path):
        return False

    size = read_dimensions(art_path)
    if size is None or not needs_rendition(*size):
        return False

    art_dir = os.path.dirname(art_path)
    hq_path = os.path.join(art_dir, hq_name_for(os.path.basename(art_path)))
    # An archive already there means this album has been through here before —
    # a re-import, say. Overwriting it with what is on disk is right: that file
    # *is* the original either way.
    try:
        shutil.copyfile(art_path, hq_path)
        _write_rendition(hq_path, art_path)
    except (OSError, ValueError) as exc:
        protocol.log(f"covers: rendition failed for {art_path}: {exc}")
        # Put the original back if the resize died after the copy: a half-made
        # rendition is worse than no rendition.
        if os.path.exists(hq_path) and not os.path.exists(art_path):
            try:
                shutil.move(hq_path, art_path)
            except OSError:
                pass
        return False

    return True


def follow_hq_cover(lib, album, old_dir: str | None, decode) -> None:
    """When a move renamed the album folder, beets relocated its own artpath
    (`item.move` gives the album a chance to move its art) — but our
    out-of-band `cover-hq.*` stayed behind. Bring it along and prune the husk.

    `decode` is the caller's path decoder: beets stores paths as bytes, and the
    two callers already have the helper.
    """
    fresh = lib.get_album(album.id) if album is not None else None
    art = decode(fresh.artpath) if fresh is not None and fresh.artpath else None
    new_dir = os.path.dirname(art) if art else None
    if not old_dir or not new_dir or old_dir == new_dir or not os.path.isdir(old_dir):
        return

    for name in os.listdir(old_dir):
        if name.startswith(HQ_PREFIX):
            try:
                shutil.move(os.path.join(old_dir, name), os.path.join(new_dir, name))
            except OSError as exc:
                protocol.log(f"covers: relocation failed: {exc}")
    try:
        if not os.listdir(old_dir):
            os.rmdir(old_dir)
    except OSError:
        pass
