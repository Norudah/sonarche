"""Repair pass: remux fragmented DASH m4a files into classic MP4.

Files downloaded before the app shipped ffmpeg kept YouTube's container as-is:
a fragmented MP4 (`moof`/`mdat` fragments, empty classic sample tables). Our
own player reads fragments fine, but Music.app, iOS and CarPlay read the
classic tables and see an empty file — 0:00 durations, broken seeking, silent
tracks. The remux is `-c copy`: same AAC stream, new container, no re-encode.

Tags are copied with mutagen rather than trusted to ffmpeg: ffmpeg's mov muxer
drops freeform atoms (`----:com.apple.iTunes:…`, where every MusicBrainz id
lives) and the embedded cover, and mutagen round-trips both exactly. The swap
is `os.replace` in the same directory, so a failure at any step leaves the
original untouched.
"""

import os
import sqlite3
import struct
import subprocess

import protocol
from library import expand_db_path

# Boxes that only exist in a fragmented MP4. `moof` is the fragments
# themselves; `sidx` is the segment index DASH puts before them. Both sit at
# the top level, so one shallow scan settles the question.
_FRAGMENT_BOXES = {b"moof", b"sidx"}

# A classic file has ~5 top-level boxes and a fragmented one a few dozen;
# anything past this is not a sane audio file, stop rather than loop.
_MAX_TOP_LEVEL_BOXES = 4096

_FFMPEG_TIMEOUT = 300


def top_level_boxes(path: str) -> list[bytes]:
    """The names of the file's top-level MP4 boxes, header reads only.

    Malformed input (truncated header, zero-size box that is not last, sizes
    pointing past EOF) ends the scan rather than raising: the caller treats
    "unreadable" as "not fragmented" and leaves the file alone.
    """
    names: list[bytes] = []
    size = os.path.getsize(path)
    with open(path, "rb") as handle:
        position = 0
        while position < size and len(names) < _MAX_TOP_LEVEL_BOXES:
            handle.seek(position)
            header = handle.read(8)
            if len(header) < 8:
                break
            length, name = struct.unpack(">I4s", header)
            if length == 1:
                wide = handle.read(8)
                if len(wide) < 8:
                    break
                length = struct.unpack(">Q", wide)[0]
                if length < 16:
                    break
            elif length == 0:
                # "To end of file" — legal only on the last box.
                names.append(name)
                break
            elif length < 8:
                break
            names.append(name)
            position += length
    return names


def is_fragmented(path: str) -> bool:
    return any(name in _FRAGMENT_BOXES for name in top_level_boxes(path))


def _copy_tags(source_path: str, target_path: str) -> None:
    """Every MP4 tag of the source onto the target, byte-exact via mutagen."""
    from mutagen.mp4 import MP4

    source = MP4(source_path)
    if not source.tags:
        return
    target = MP4(target_path)
    if target.tags is None:
        target.add_tags()
    target.tags.clear()
    for key, value in source.tags.items():
        target.tags[key] = value
    target.save()


def _remux_file(ffmpeg: str, path: str) -> None:
    directory, basename = os.path.split(path)
    # Dot-prefixed so a concurrent folder scan reads it as clutter, and in the
    # same directory so the final `os.replace` stays one atomic rename.
    tmp = os.path.join(directory, f".remux-{basename}")
    try:
        completed = subprocess.run(
            [
                ffmpeg,
                "-nostdin",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                path,
                "-map",
                "0:a",
                "-c",
                "copy",
                "-movflags",
                "+faststart",
                "-f",
                "mp4",
                tmp,
            ],
            capture_output=True,
            text=True,
            timeout=_FFMPEG_TIMEOUT,
        )
        if completed.returncode != 0:
            detail = (completed.stderr or "").strip() or f"exit {completed.returncode}"
            raise RuntimeError(f"ffmpeg: {detail[:300]}")
        _copy_tags(path, tmp)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def _library_paths(db_path: str, library_dir: str) -> list[str]:
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=20.0)
    try:
        rows = conn.execute("SELECT path FROM items").fetchall()
    finally:
        conn.close()
    paths = (expand_db_path(stored, library_dir) for (stored,) in rows)
    return [p for p in paths if p and p.lower().endswith((".m4a", ".mp4")) and os.path.exists(p)]


def handle(request_id: str, params: dict) -> dict:
    ffmpeg = params["ffmpeg"]
    targets = _library_paths(params["beets_db"], params["library_dir"])
    fragmented = [path for path in targets if is_fragmented(path)]

    remuxed = 0
    failures: list[str] = []
    for index, path in enumerate(fragmented):
        protocol.send_event(
            request_id,
            "remux_progress",
            {"done": index, "total": len(fragmented)},
        )
        try:
            _remux_file(ffmpeg, path)
            remuxed += 1
        except Exception as exc:  # noqa: BLE001 — one bad file must not stop the pass
            failures.append(os.path.basename(path))
            protocol.log(f"remux failed for {os.path.basename(path)}: {exc}")

    if fragmented:
        protocol.log(f"remux pass: {remuxed}/{len(fragmented)} repaired, {len(targets)} scanned")
    return {
        "scanned": len(targets),
        "fragmented": len(fragmented),
        "remuxed": remuxed,
        "failed": failures,
    }
