"""An album's cover file, kept small enough to draw.

An album carries exactly one picture: `cover.jpg` — beets' own `artpath`, the
display-sized rendition the interface reads and the files embed. Up to 2.x a
full-size original was archived beside it as `cover-hq.*`; that convention is
gone (nothing ever displayed it, and it confused more than it kept), but its
leftovers still exist in libraries created by those versions, so the prefix
below survives as the mark every cleanup path recognises.

Why a size ceiling at all: an image on disk is compressed, but drawing it
means decompressing it into pixels, and that costs width x height x 4 bytes
however small the file is. A 5000x5000 cover is 100 MB of memory to paint a
40 px thumbnail, against 1 MB for a 500 px one. The rendition exists so
nothing on screen ever pays that.
"""

import os
import shutil

import protocol

# The archive prefix Sonarche <= 2.x wrote. Only referenced to *remove* the
# files it left behind — at the one-shot launch cleanup, and wherever a folder
# holding one must still empty out.
HQ_PREFIX = "cover-hq."

# The longest side a cover may have once the interface reads it. Matches the
# rendition the download path already writes, so an imported album and a
# downloaded one cost the same to draw.
DISPLAY_MAX_PX = 500

# Pillow, not `sips`: the resize used to shell out to a macOS-only binary, which
# was the sidecar's last tie to one OS. Reading the size is also a header read
# now instead of a process spawn, which matters — the import sweep asks the
# question once per album and answers "already small enough" almost every time.


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
    from PIL import Image

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
    from PIL import Image

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

    An oversized cover is replaced, at its own path, by a rendition — so
    beets' `artpath` stays valid and nothing else has to learn about the swap.
    Returns whether a rendition was made.

    Shrinking is deliberate, not a loss: the library's copy exists to be
    displayed and embedded, both capped at DISPLAY_MAX_PX, and the user's own
    source file (an imported folder, a picked image) is never the file at
    `artpath` — imports copy.
    """
    if not art_path or not os.path.exists(art_path):
        return False

    size = read_dimensions(art_path)
    if size is None or not needs_rendition(*size):
        return False

    # Through a scratch copy so a resize that dies half-way leaves the
    # original in place rather than a truncated cover.
    scratch = f"{art_path}.sonarche-original"
    try:
        shutil.copyfile(art_path, scratch)
        _write_rendition(scratch, art_path)
    except (OSError, ValueError) as exc:
        protocol.log(f"covers: rendition failed for {art_path}: {exc}")
        # A half-made rendition is worse than no rendition.
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
    """Remove a working copy, quietly. A leftover here is clutter in someone's
    album folder, never a reason to fail an import sweep."""
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        pass


def remove_legacy_archives(art_dir: str) -> int:
    """Delete the `cover-hq.*` files a <= 2.x install left in one album folder.
    Returns how many went. Every remover funnels through here so the rule —
    match on the prefix, log and carry on — stays in one place."""
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
