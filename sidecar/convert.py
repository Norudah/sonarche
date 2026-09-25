"""Re-encode the whole library into one audio format.

- The original is deleted only after a clean, non-empty conversion.
- Tags are written from the database after the swap, not copied by ffmpeg.
- The cover is dropped by the encoder and re-embedded afterwards.

Files already in the target format are skipped, so the pass is safe to re-run.
"""

import os
import subprocess

import audio_format
import protocol

# See `enrich._NO_WINDOW`.
_NO_WINDOW = (
    {"creationflags": subprocess.CREATE_NO_WINDOW}
    if hasattr(subprocess, "CREATE_NO_WINDOW")
    else {}
)

# On timeout the file counts as failed and the original survives.
_FFMPEG_TIMEOUT = 15 * 60

_PROGRESS_EVERY = 1


def _decode(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def extension_of(path: str) -> str:
    return os.path.splitext(path or "")[1].lstrip(".").lower()


def needs_conversion(path: str, target: str) -> bool:
    """Whether this file must be re-encoded to reach `target`. Extension-based:
    the library's filing always writes the container's extension."""
    current = extension_of(path)
    if not current:
        return False
    # Same container under another name.
    if target == "m4a" and current in ("m4a", "m4b", "mp4"):
        return False
    return current != target


def _album_cover(lib, item) -> tuple[bytes, bool] | None:
    """The album's cover.jpg, or for a singleton the file's embedded picture."""
    album = item.get_album() if item.album_id is not None else None
    art = _decode(album.artpath) if album is not None and album.artpath else None
    if art and os.path.exists(art):
        try:
            with open(art, "rb") as handle:
                data = handle.read()
            return data, data[:4] == b"\x89PNG"
        except OSError as exc:
            protocol.log(f"convert: album cover unreadable: {exc}")

    import mediafile

    try:
        images = mediafile.MediaFile(_decode(item.path)).images or []
    except Exception:  # an unreadable picture must not stop a conversion
        return None
    for image in images:
        if image.data:
            return image.data, image.data[:4] == b"\x89PNG"
    return None


def _read_audio_properties(item) -> None:
    """Re-read the new file's audio properties, but not its tags (`item.read()`
    would let the container overwrite the library's values)."""
    import mediafile
    from beets.library import Item

    try:
        media = mediafile.MediaFile(_decode(item.path))
    except Exception as exc:
        protocol.log(f"convert: cannot re-read {_decode(item.path)}: {exc}")
        return
    for key in Item._media_fields - Item._media_tag_fields:
        value = getattr(media, key, None)
        if value is not None:
            setattr(item, key, value)


def _run_ffmpeg(ffmpeg: str, source: str, dest: str, target: str) -> bool:
    command = audio_format.ffmpeg_command(ffmpeg, source, dest, target)
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            errors="replace",
            timeout=_FFMPEG_TIMEOUT,
            **_NO_WINDOW,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        protocol.log(f"convert: ffmpeg failed to run on {os.path.basename(source)}: {exc}")
        return False
    if result.returncode != 0:
        protocol.log(f"convert: ffmpeg failed on {os.path.basename(source)}: {result.stderr.strip()}")
        return False
    # ffmpeg can exit 0 without writing anything.
    return os.path.exists(dest) and os.path.getsize(dest) > 0


def _convert_one(lib, item, ffmpeg: str, target: str) -> str:
    from beets.util import bytestring_path

    source = _decode(item.path)
    if not os.path.exists(source):
        protocol.log(f"convert: {source} is gone, skipped")
        return "missing"

    cover = _album_cover(lib, item)
    working = f"{os.path.splitext(source)[0]}.sonarche-converting.{target}"
    if not _run_ffmpeg(ffmpeg, source, working, target):
        if os.path.exists(working):
            try:
                os.remove(working)
            except OSError:
                pass
        return "failed"

    try:
        os.remove(source)
    except OSError as exc:
        # Keeping both files would silently duplicate the track.
        protocol.log(f"convert: cannot replace {source} ({exc}), conversion dropped")
        try:
            os.remove(working)
        except OSError:
            pass
        return "failed"

    item.path = bytestring_path(working)
    item.store()
    try:
        # Only the suffix changed; the album's cover hasn't moved.
        item.move(with_album=False)
    except Exception as exc:
        protocol.log(f"convert: move failed: {exc}")

    _read_audio_properties(item)
    item.store()
    try:
        item.write()
    except Exception as exc:  # DB is authoritative; file tags are best-effort
        protocol.log(f"convert: tag write failed: {exc}")
    if cover:
        import enrich

        enrich.embed_cover(item, *cover)
    return "converted"


def handle(request_id: str, params: dict) -> dict:
    from beets.library import Library

    target = audio_format.normalize(params.get("audio_format"))
    ffmpeg = params.get("ffmpeg")
    if not ffmpeg or not os.path.exists(ffmpeg):
        raise RuntimeError("ffmpeg is required to convert the library")
    if not os.path.exists(params["beets_db"]):
        return {"format": target, "total": 0, "converted": 0, "failed": 0, "skipped": 0}

    lib = Library(params["beets_db"], directory=params["library_dir"])
    try:
        items = list(lib.items())
        pending = [item for item in items if needs_conversion(_decode(item.path), target)]
        total = len(pending)
        protocol.log(
            f"convert: {total} of {len(items)} track(s) to re-encode to {target}"
        )
        counts = {"converted": 0, "failed": 0, "missing": 0}
        # Sent upfront so an empty pass can close its progress bar.
        protocol.send_event(
            request_id, "convert_progress", {"done": 0, "total": total, "format": target}
        )
        for done, item in enumerate(pending, start=1):
            outcome = _convert_one(lib, item, ffmpeg, target)
            counts[outcome] = counts.get(outcome, 0) + 1
            if done % _PROGRESS_EVERY == 0 or done == total:
                protocol.send_event(
                    request_id,
                    "convert_progress",
                    {
                        "done": done,
                        "total": total,
                        "format": target,
                        "title": item.title or "",
                        "artist": item.artist or "",
                        "failed": counts["failed"],
                    },
                )
        protocol.log(
            f"convert: {counts['converted']} converted, {counts['failed']} failed, "
            f"{counts['missing']} missing"
        )
        return {
            "format": target,
            "total": total,
            "converted": counts["converted"],
            "failed": counts["failed"],
            "skipped": len(items) - total,
        }
    finally:
        lib._close()
