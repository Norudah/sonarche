"""Import an existing music folder into the beets library, as-is.

- `-M -c`: copy, never move. The beets config sets `move: yes`, which beets
  checks before `copy`, so `-c` alone would move the user's originals.
- `-A`: no autotag; existing tags are kept and MusicBrainz isn't queried.
- The grouping flag comes from the caller, see `GROUPINGS`.
"""

import os
import subprocess
import threading
import time

import auto_collection
import import_recap
import protocol
from importer import beet_bin

# Time for beets to finish its SQLite transaction after SIGTERM.
_CANCEL_GRACE_SECONDS = 5.0

# folder: one directory = one album (beets' default).
# tags (-g): regroup each directory by its album tag.
# tracks (-s): every file is a singleton, for folders of unrelated tracks.
GROUPINGS = {
    "folder": [],
    "tags": ["-g"],
    "tracks": ["-s"],
}
DEFAULT_GROUPING = "folder"


def handle(request_id: str, params: dict) -> dict:
    folder = params["folder"]
    config_path = params["beets_config"]
    # Stamped on every imported item: beets keeps no record of a run.
    batch = params["import_id"]
    if not os.path.isdir(folder):
        raise RuntimeError(f"folder not found: {folder}")

    grouping = params.get("grouping") or DEFAULT_GROUPING
    if grouping not in GROUPINGS:
        raise RuntimeError(f"unknown grouping: {grouping}")

    category = (params.get("category") or "").strip()
    marks = [f"--set={import_recap.BATCH_FIELD}={batch}"]
    if category:
        marks.append(f"--set=grouping={category}")

    cmd = [beet_bin(), "--config", config_path, "import",
           "--quiet", "--quiet-fallback=asis", "-A", "-M", "-c",
           *GROUPINGS[grouping], *marks, folder]
    protocol.log(f"library_import: grouping={grouping}")

    protocol.send_event(request_id, "library_import_progress", {"folders": 0, "folder": None})

    # Streamed so progress is reported per folder. stdout and stderr are merged:
    # beets' choice of stream for each message is not a contract.
    proc = subprocess.Popen(
        cmd,
        # Keep beets off the NDJSON protocol pipe: a prompt would read or hang on it.
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        # The Windows locale (cp1252) would fail on accented paths.
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )

    # The sidecar handles one request at a time, so cancel arrives as a file
    # polled by a watcher thread. beets commits per album, so SIGTERM leaves a
    # consistent library.
    cancelled = threading.Event()
    cancel_file = params.get("cancel_file")
    if cancel_file:
        _forget_cancel(cancel_file)
        threading.Thread(
            target=_watch_cancel, args=(proc, cancel_file, cancelled), daemon=True
        ).start()

    folders = 0
    tail: list[str] = []
    assert proc.stdout is not None
    for line in proc.stdout:
        line = line.rstrip()
        if not line:
            continue
        protocol.log(f"beet: {line}")
        # Last lines only, for the error message.
        tail.append(line)
        del tail[:-20]

        # Only paths inside the folder are progress steps.
        if not line.startswith(folder):
            continue
        folders += 1
        protocol.send_event(request_id, "library_import_progress", {"folders": folders, "folder": line})

    code = proc.wait()
    if cancel_file:
        _forget_cancel(cancel_file)
    if code != 0 and not cancelled.is_set():
        raise RuntimeError(f"beet import failed (exit {code}): {' / '.join(tail)[:500]}")

    # Also runs after a cancel, on what was imported.
    _write_repaired_tags(params, batch)
    _stage_singleton_covers(params, batch)

    # Before the recap, so collections aren't counted as gapped albums.
    collections = auto_collection.mark(params["beets_db"], params["library_dir"], batch)

    # Before the recap, which counts what the cover pass may repair.
    renditions = _shrink_covers(request_id, params, batch)
    recap = import_recap.build(params["beets_db"], batch)
    if recap is not None:
        recap["collections"] = collections

    return {
        "folders": folders,
        "renditions": renditions,
        "recap": recap,
        "cancelled": cancelled.is_set(),
    }


def _watch_cancel(proc, cancel_file: str, cancelled: threading.Event) -> None:
    """Terminate beets when the cancel file appears.

    Sets the event before terminating so the reader treats the non-zero exit
    as a cancel.
    """
    while proc.poll() is None:
        if os.path.exists(cancel_file):
            cancelled.set()
            protocol.log("library_import: cancel requested, stopping beets")
            proc.terminate()
            try:
                proc.wait(timeout=_CANCEL_GRACE_SECONDS)
            except subprocess.TimeoutExpired:
                protocol.log("library_import: beets ignored the term, killing it")
                proc.kill()
            return
        time.sleep(0.5)


def _forget_cancel(cancel_file: str) -> None:
    """Remove the cancel file so a stale one cannot stop the next run."""
    try:
        os.remove(cancel_file)
    except OSError:
        pass


def _write_repaired_tags(params: dict, batch: str) -> None:
    """Write tags the repair plugin recovered into the copied files.

    An as-is import never writes tags, so repaired values would otherwise exist
    only in the database. Only the copies are written, and only where needed.
    """
    import mediafile
    from beets.library import Library

    import enrich

    lib = Library(params["beets_db"], directory=params["library_dir"])
    written = 0
    try:
        for item in lib.items(f"{import_recap.BATCH_FIELD}:{batch}"):
            path = enrich._decode(item.path)
            try:
                current = mediafile.MediaFile(path)
            except Exception:  # an unreadable copy keeps its tags; the DB has the truth
                continue
            # The plugin fills artist/track only when the title was empty.
            repaired = (item.title and not current.title) or (
                item.year and current.year != item.year
            )
            if repaired and item.try_write():
                written += 1
    finally:
        lib._close()
    if written:
        protocol.log(f"import: repaired tags written into {written} file(s)")


def _stage_singleton_covers(params: dict, batch: str) -> None:
    """Extract each singleton's embedded cover next to the file and record its
    path on the item (`ITEM_ART_KEY`), since singletons have no album artpath.

    Recorded rather than probed so the listing reads it in one query. Album
    tracks are handled per album by `_shrink_covers`.
    """
    import mediafile
    from beets.library import Library

    import enrich
    import library

    lib = Library(params["beets_db"], directory=params["library_dir"])
    staged = 0
    try:
        for item in lib.items(f"{import_recap.BATCH_FIELD}:{batch}"):
            if item.album_id:
                continue
            path = enrich._decode(item.path)
            try:
                images = mediafile.MediaFile(path).images or []
            except Exception:  # an unreadable copy simply keeps no cover
                continue
            if not images:
                continue
            image = images[0]
            ext = ".png" if "png" in (image.mime_type or "") else ".jpg"
            art = os.path.splitext(path)[0] + ext
            try:
                with open(art, "wb") as fh:
                    fh.write(image.data)
            except OSError as exc:  # a missing cover is a defect, not a failure
                protocol.log(f"import: could not stage a cover for {path}: {exc}")
                continue
            item[library.ITEM_ART_KEY] = art
            item.store()
            staged += 1
    finally:
        lib._close()
    if staged:
        protocol.log(f"import: {staged} singleton cover(s) taken out of the files")


def _shrink_covers(request_id: str, params: dict, batch: str) -> int:
    """Give every album touched by this import a displayable cover.

    Artless albums adopt their tracks' embedded image; oversized covers get a
    500 px rendition. Limited to this run's albums (found via the batch mark).
    """
    from beets.library import Library

    import covers
    import enrich

    lib = Library(params["beets_db"], directory=params["library_dir"])
    try:
        touched = {
            item.album_id
            for item in lib.items(f"{import_recap.BATCH_FIELD}:{batch}")
            if item.album_id
        }
        albums = [album for album in (lib.get_album(album_id) for album_id in sorted(touched)) if album]
        total = len(albums)
        made = 0
        adopted = 0
        for index, album in enumerate(albums, start=1):
            art = enrich._decode(album.artpath) if album.artpath else None
            if (art is None or not os.path.exists(art)) and _adopt_embedded_cover(album):
                adopted += 1
                art = enrich._decode(album.artpath)
            if art is not None and covers.ensure_display_rendition(art):
                made += 1
            protocol.send_event(
                request_id,
                "library_covers_progress",
                {"done": index, "total": total, "renditions": made},
            )
        if adopted:
            protocol.log(f"import: {adopted} cover(s) recovered from file tags")
        return made
    finally:
        lib._close()


def _adopt_embedded_cover(album) -> bool:
    """Give an artless album the first embedded image among its tracks,
    filed by `set_art` under beets' `cover.*` name.
    """
    import mediafile

    import enrich

    for item in album.items():
        path = enrich._decode(item.path)
        try:
            images = mediafile.MediaFile(path).images or []
        except Exception:  # one unreadable file must not cost the album its shot
            continue
        if not images:
            continue
        image = images[0]
        ext = ".png" if "png" in (image.mime_type or "") else ".jpg"
        staged = os.path.join(os.path.dirname(path), f".sonarche-embedded{ext}")
        try:
            with open(staged, "wb") as fh:
                fh.write(image.data)
            album.set_art(staged, copy=True)
            album.store()
        except Exception as exc:  # a missing cover is a defect, not a failure
            protocol.log(f"import: embedded cover adoption failed for album {album.id}: {exc}")
            return False
        finally:
            try:
                os.remove(staged)
            except OSError:
                pass
        return True
    return False
