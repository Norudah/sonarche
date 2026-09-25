"""Repair pass: remux fragmented DASH m4a files into classic MP4.

Files downloaded before ffmpeg was bundled are fragmented, which Music.app,
iOS and CarPlay read as empty. The remux is `-c copy` (no re-encode).

Tags are copied with mutagen because ffmpeg drops freeform atoms (MusicBrainz
ids) and the cover. The final swap is an atomic `os.replace`.
"""

import os
import sqlite3
import struct
import subprocess

import protocol
from library import expand_db_path

# Top-level boxes that only exist in a fragmented MP4.
_FRAGMENT_BOXES = {b"moof", b"sidx"}

# Guards against looping on a malformed file.
_MAX_TOP_LEVEL_BOXES = 4096

_FFMPEG_TIMEOUT = 300


def top_level_boxes(path: str) -> list[bytes]:
    """Top-level MP4 box names, from headers only. Malformed input ends the
    scan instead of raising (treated as "not fragmented").
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
                # Size 0 means "to end of file", legal only on the last box.
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
    # Same directory keeps the final `os.replace` atomic.
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


def _library_paths(db_path: str, library_dir: str, since_id: int) -> tuple[list[tuple[int, str]], int]:
    """`(item id, path)` pairs newer than `since_id`, and the newest id seen.

    `since_id` is the watermark of the last completed pass. Non-m4a or missing
    files still advance the cursor. No database (first run, after an erase)
    means nothing to repair.
    """
    if not os.path.exists(db_path):
        return [], since_id
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=20.0)
    try:
        rows = conn.execute("SELECT id, path FROM items WHERE id > ? ORDER BY id", (since_id,)).fetchall()
    finally:
        conn.close()
    newest = rows[-1][0] if rows else since_id
    expanded = ((item_id, expand_db_path(stored, library_dir)) for item_id, stored in rows)
    targets = [(i, p) for i, p in expanded if p and p.lower().endswith((".m4a", ".mp4")) and os.path.exists(p)]
    return targets, newest


def _checked_through(since_id: int, newest_id: int, failed_ids: list[int]) -> int:
    """How far the watermark may advance: up to, not past, the first failure,
    so failed files are retried next launch.
    """
    if failed_ids:
        return max(since_id, min(failed_ids) - 1)
    return newest_id


def handle(request_id: str, params: dict) -> dict:
    ffmpeg = params["ffmpeg"]
    since_id = int(params.get("since_id", 0))
    targets, newest_id = _library_paths(params["beets_db"], params["library_dir"], since_id)
    fragmented = [(item_id, path) for item_id, path in targets if is_fragmented(path)]

    remuxed = 0
    failures: list[str] = []
    failed_ids: list[int] = []
    for index, (item_id, path) in enumerate(fragmented):
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
            failed_ids.append(item_id)
            protocol.log(f"remux failed for {os.path.basename(path)}: {exc}")

    if fragmented:
        protocol.log(f"remux pass: {remuxed}/{len(fragmented)} repaired, {len(targets)} scanned")
    return {
        "scanned": len(targets),
        "fragmented": len(fragmented),
        "remuxed": remuxed,
        "failed": failures,
        "checked_through": _checked_through(since_id, newest_id, failed_ids),
    }
