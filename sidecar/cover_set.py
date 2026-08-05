"""Replace an album's cover with an image the user picked on disk.

The one write path where the picture does not come from a service: the user
already has the album's real artwork and wants the library to carry it. The
result follows the two-file convention to the letter — the chosen image
(cropped square) becomes `cover-hq.*`, a 500 px rendition becomes beets'
`artpath`, and the rendition is embedded into the album's m4a files, exactly
as a downloaded cover would have been.

Covers are square in every frame the interface draws, so a non-square source
is cropped rather than letterboxed. The crop rectangle comes from the front
(the user places it); absent, the center square is taken. Coordinates apply to
the image *after* EXIF orientation, which is also how a browser displays it —
what the user framed is what gets cut.
"""

import io
import os

from PIL import Image, ImageOps

import covers
import protocol

# The archive is a user file we copy, not a download we can retry: refuse
# anything that would balloon memory when decoded. 12k x 12k is far beyond any
# real cover and still decodes in well under a second.
MAX_SOURCE_PX = 12_000

ART_SOURCE = "Local file"

_PROVISIONAL_COVER_KEY = "sonarche_provisional_cover"


def square_crop_box(width: int, height: int, crop: dict | None) -> tuple[int, int, int]:
    """The (left, top, size) square actually cut from a width x height image.

    A requested crop is clamped into the frame rather than rejected: the front
    computes it from a scaled preview, and a rounding drift of one pixel must
    not fail the whole replacement. No crop means the centered square.
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
        # High quality on purpose: this encode writes the *archive* when the
        # source needed cropping, and an archive is kept, not re-made.
        image.save(buffer, format="JPEG", quality=92)
    return buffer.getvalue()


def prepare_cover(source_path: str, crop: dict | None) -> tuple[bytes, bytes, bool, int]:
    """(hq_bytes, thumb_bytes, is_png, side) from the user's file.

    The archive keeps the source's own bytes whenever nothing had to change —
    already square, no EXIF rotation, already JPEG or PNG. Re-encoding a file
    that needed no edit would quietly degrade the one copy meant to be kept.
    """
    with Image.open(source_path) as opened:
        source_format = opened.format
        # exif_transpose always hands back a copy, so "was anything rotated"
        # is read off the tag itself, not off object identity.
        upright = opened.getexif().get(0x0112, 1) in (None, 1)
        oriented = ImageOps.exif_transpose(opened)
        width, height = oriented.size
        if max(width, height) > MAX_SOURCE_PX:
            raise RuntimeError(f"image too large: {width}x{height} (max {MAX_SOURCE_PX} px per side)")

        left, top, size = square_crop_box(width, height, crop)
        untouched = (left, top, size) == (0, 0, width) and upright
        square = oriented.crop((left, top, left + size, top + size))

        is_png = source_format == "PNG"
        if untouched and source_format in ("JPEG", "PNG"):
            with open(source_path, "rb") as f:
                hq_bytes = f.read()
        else:
            hq_bytes = _encode(square, is_png)

        thumb = square.copy()
        thumb.thumbnail((covers.DISPLAY_MAX_PX, covers.DISPLAY_MAX_PX))
        thumb_bytes = _encode(thumb, is_png)

    return hq_bytes, thumb_bytes, is_png, size


def _clear_stale_art(album, old_art: str | None, decode) -> None:
    """Remove files the replacement obsoletes: every cover-hq.* (the archive is
    being deliberately replaced — the import sweep's "never overwrite" rule
    protects against *accidents*, and this is the opposite of one), and the old
    artpath when a format change gave the new one a different name."""
    new_art = decode(album.artpath) if album.artpath else None
    if not new_art:
        return
    art_dir = os.path.dirname(new_art)
    try:
        names = os.listdir(art_dir)
    except OSError:
        names = []
    for name in names:
        if name.startswith(covers.HQ_PREFIX):
            try:
                os.remove(os.path.join(art_dir, name))
            except OSError as exc:
                protocol.log(f"cover_set: could not remove stale archive {name}: {exc}")
    if old_art and old_art != new_art and os.path.exists(old_art):
        try:
            os.remove(old_art)
        except OSError as exc:
            protocol.log(f"cover_set: could not remove old art {old_art}: {exc}")


def handle(_request_id: str, params: dict) -> dict:
    from beets.library import Library

    import enrich

    source_path = params["source_path"]
    if not os.path.isfile(source_path):
        raise RuntimeError(f"file not found: {source_path}")

    lib = Library(params["beets_db"], directory=params["library_dir"])
    album = lib.get_album(params["album_id"])
    if album is None:
        raise RuntimeError(f"album not found: {params['album_id']}")

    def decode(raw) -> str:
        return raw.decode("utf-8", "surrogateescape") if isinstance(raw, bytes) else raw

    hq_bytes, thumb_bytes, is_png, side = prepare_cover(source_path, params.get("crop"))

    old_art = decode(album.artpath) if album.artpath else None
    # The thumb becomes beets' artpath; the archive is only written after, once
    # artpath says which directory the album lives in.
    enrich.set_album_art(album, thumb_bytes, is_png, source=ART_SOURCE)
    _clear_stale_art(album, old_art, decode)
    enrich.save_hq_cover(album, hq_bytes, is_png)

    embedded = 0
    for item in album.items():
        enrich.embed_cover(item, thumb_bytes, is_png)
        embedded += 1
        # A user-chosen cover is real art: the "video thumbnail standing in"
        # flag has nothing left to warn about.
        if item.get(_PROVISIONAL_COVER_KEY):
            del item[_PROVISIONAL_COVER_KEY]
            item.store()

    art_path = decode(album.artpath) if album.artpath else None
    protocol.log(f"cover_set: album {album.id} now carries {art_path} ({side}x{side} archived)")
    return {"art_path": art_path, "side": side, "embedded": embedded}
