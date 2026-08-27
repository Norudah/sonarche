"""Re-encode the whole library into one audio format.

The heavy half of the audio-format setting. Changing the setting decides what
the *next* download will be; this is what makes the answer retroactive, and it
is the only pass in the app that rewrites the audio itself — everything else
moves files and edits tags.

Three things it is careful about, in the order they can go wrong:

- **The original is deleted last.** ffmpeg writes beside the source under a
  working name; only a conversion that came back clean and left a non-empty file
  gets to remove what it replaced. A pass killed mid-track costs a temporary
  file, never a track.
- **The tags are the database's, not the file's.** beets writes them into the
  new container after the swap, so a format that spells a field differently (or
  cannot hold it at all) never silently rewrites the library's own answer.
- **The cover is re-embedded by hand.** The encoder is told to drop the attached
  picture — carrying artwork across containers is where ffmpeg invocations go to
  die — and the record's own `cover.jpg` is written back in afterwards, through
  the one writer that knows every container.

Skipping is the common case and it is free: a file already in the target format
is not touched, which is what makes the pass safe to re-run after a failure and
instant when the setting has not really changed.
"""

import os
import subprocess

import audio_format
import protocol

# Same reason as `enrich._NO_WINDOW`: the sidecar has no console of its own, so
# on Windows every ffmpeg spawn would flash a black window — once per track,
# through a pass that walks the whole library.
_NO_WINDOW = (
    {"creationflags": subprocess.CREATE_NO_WINDOW}
    if hasattr(subprocess, "CREATE_NO_WINDOW")
    else {}
)

# Generous: a long track on a slow machine, not a wedged process holding the
# whole pass. Exceeded, the file is counted failed and the original survives.
_FFMPEG_TIMEOUT = 15 * 60

# How often the progress event goes out. Per track, not batched like the genre
# pass: a conversion is seconds of CPU per file, and a bar that only moves every
# tenth track reads as frozen on a small library.
_PROGRESS_EVERY = 1


def _decode(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def extension_of(path: str) -> str:
    """Lowercase extension with no dot. Pure."""
    return os.path.splitext(path or "")[1].lstrip(".").lower()


def needs_conversion(path: str, target: str) -> bool:
    """Whether this file has to be re-encoded to reach `target`. Pure.

    Extension-only, and deliberately so: the library's own filing writes the
    container's extension, so the name is the truth here — and asking ffprobe
    per file would spend a process on a question already answered for every
    track that has nothing to do.
    """
    current = extension_of(path)
    if not current:
        return False
    # `m4b` is the audiobook flavour of the same container, and `mp4` the same
    # container under its other name: re-encoding either to `m4a` would burn a
    # generation of quality to change three letters.
    if target == "m4a" and current in ("m4a", "m4b", "mp4"):
        return False
    return current != target


def _album_cover(lib, item) -> tuple[bytes, bool] | None:
    """The record's own cover, or the picture already inside the file.

    The album's `cover.jpg` first — it is what every other surface reads, so a
    conversion is not the moment for a track to end up with a different one. A
    singleton has no row to ask, and then its own embedded art is the only
    answer there is.
    """
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
    """Re-read what the new file *is* — format, bitrate, length, channels.

    Only the properties, never the tags: `item.read()` would pull the whole tag
    set back out of the file and let the container's own idea of a genre
    delimiter, or of what fits in a field, overwrite the library.
    """
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
    # A zero exit with nothing on disk is ffmpeg having written to a path it
    # could not keep — treated as a failure, so the original is never removed.
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
        # The new file is fine but the old one will not go: keeping both would
        # double the record silently, so the conversion is abandoned instead.
        protocol.log(f"convert: cannot replace {source} ({exc}), conversion dropped")
        try:
            os.remove(working)
        except OSError:
            pass
        return "failed"

    item.path = bytestring_path(working)
    item.store()
    try:
        # Off the working name and onto the filing rules — same folder, same
        # numbering, only the suffix changed. `with_album=False`: the record's
        # cover has not moved, and one album pass per track would be N times
        # the same no-op.
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
        # Sent before the first track so a bar that has nothing to do can close
        # itself rather than sit at zero waiting for an event that never comes.
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
