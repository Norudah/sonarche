"""Import an existing music folder into the beets library.

Distinct from `importer.py`, which files one staged download at a time. This
one is handed a tree someone has been collecting for years and lets beets do
what it is good at: walking it, grouping tracks into albums, reading the tags
that are already in the files.

Two flags carry the whole doctrine:

- ``-M`` (nomove) and ``-c`` (copy). Our beets config sets ``move: yes``, which
  is right for a staged download we own and catastrophic for someone's own
  library — beets' importer checks move *before* copy, so ``-c`` alone would
  not save the originals. Nothing here may touch the files it reads.
- ``-A`` (noautotag). The import is as-is: existing tags are kept, and no
  MusicBrainz call is made. Matching a whole library against MusicBrainz is a
  different job with a different cost, and it is not this one.
"""

import os
import subprocess
import threading
import time

import import_recap
import protocol
from importer import beet_bin

# How long a terminated beets gets to die on its own before being killed
# outright. SIGTERM lets it finish the SQLite transaction it is in; a process
# that ignores it for this long is not going to honour it at all.
_CANCEL_GRACE_SECONDS = 5.0


def handle(request_id: str, params: dict) -> dict:
    folder = params["folder"]
    config_path = params["beets_config"]
    # The app's id for this run. Stamped on every item beets takes on, which is
    # the only way to ask afterwards what *this* import brought in — beets keeps
    # no record of a run, and `added` timestamps cannot separate two imports
    # started a minute apart.
    batch = params["import_id"]
    if not os.path.isdir(folder):
        raise RuntimeError(f"folder not found: {folder}")

    cmd = [beet_bin(), "--config", config_path, "import",
           "--quiet", "--quiet-fallback=asis", "-A", "-M", "-c",
           f"--set={import_recap.BATCH_FIELD}={batch}", folder]

    protocol.send_event(request_id, "library_import_progress", {"folders": 0, "folder": None})

    # Streamed rather than collected: beets names each folder as it reaches it,
    # and on a library of thousands that line is the only thing saying the
    # import is alive. `subprocess.run` would hand it all over at the end, by
    # which point nobody needs it.
    #
    # One merged stream: beets writes those folder names to *stderr* in quiet
    # mode (measured, not assumed) while other messages go to stdout, and which
    # line lands where is not a contract we should depend on.
    proc = subprocess.Popen(
        cmd,
        # Closed on purpose. Without it beets inherits the sidecar's stdin —
        # the NDJSON protocol pipe — and its resume prompt ("Import was
        # interrupted. Resume?") would read a protocol line, or hang on one
        # that never comes, until the 6 h timeout. `resume: no` in the config
        # is the first guard; this is the one that holds if beets ever asks
        # anything else.
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        # Spelled out rather than left to the locale, which on Windows is
        # cp1252: beets names each folder it reaches, and one accent in a path
        # would end a 4 000-track import on a decode error. `replace` because
        # this is another program's output — a byte we cannot read should cost
        # a garbled character in a log line, never the import.
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )

    # The sidecar reads one request at a time, so a cancel can never arrive as
    # a protocol message while this one runs. It arrives as a file instead: the
    # app writes `cancel_file` and this thread, the only part of the process
    # with nothing else to do, notices and terminates beets. beets commits
    # album by album, so a SIGTERM between commits leaves a consistent library
    # holding everything imported so far — at worst one file copied but not
    # yet recorded, which a later import of the same folder re-copies.
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
        # Kept for the error message: a failure's cause is in the last thing it
        # said, and holding the whole log of a 4 000-track import is not worth
        # the memory.
        tail.append(line)
        del tail[:-20]

        # A progress line is a path inside the folder being imported. Anything
        # else beets says is a message about the import, not a step of it, and
        # counting it would walk the bar forward on a warning.
        if not line.startswith(folder):
            continue
        folders += 1
        protocol.send_event(request_id, "library_import_progress", {"folders": folders, "folder": line})

    code = proc.wait()
    if cancel_file:
        _forget_cancel(cancel_file)
    if code != 0 and not cancelled.is_set():
        raise RuntimeError(f"beet import failed (exit {code}): {' / '.join(tail)[:500]}")

    # On a cancel everything below still runs: the albums that landed are in
    # the library for good, and they deserve their repaired tags, their covers
    # and an honest recap just as much as a full run's. All three passes are
    # bounded by what is already on disk — the open-ended part, the copy, is
    # what the cancel stopped.
    _write_repaired_tags(params, batch)

    # The cover pass runs first, sequentially, and the recap reads after it —
    # the pass can now *change* what the recap counts (an album whose cover it
    # recovered from the file tags is no longer "without art"), and counting
    # before it ran would report defects that were already repaired.
    renditions = _shrink_covers(request_id, params)
    recap = import_recap.build(params["beets_db"], batch)

    return {
        "folders": folders,
        "renditions": renditions,
        "recap": recap,
        "cancelled": cancelled.is_set(),
    }


def _watch_cancel(proc, cancel_file: str, cancelled: threading.Event) -> None:
    """Poll for the cancel file while beets runs; terminate it on sight.

    A poll rather than a watcher: half a second of latency on a deliberate
    stop is imperceptible, and polling has no platform-specific failure
    modes. Sets the event *before* terminating, so the reader loop knows the
    non-zero exit it is about to see was asked for.
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
    """Remove the cancel file, so a stale one cannot stop the next run."""
    try:
        os.remove(cancel_file)
    except OSError:
        pass


def _write_repaired_tags(params: dict, batch: str) -> None:
    """Put what the repair plugin recovered into the copies' own tags.

    An as-is import never writes tags — beets only writes when the autotagger
    changed metadata — so a title `sonarche_import` read from the filename
    exists in the database and nowhere else, and the copy would still say
    nothing to any other player. The copies are ours to write; the originals
    were never touched. One header read per item, a write only where the
    repair actually landed: on a library that needed no repair this pass
    costs reads and writes nothing.
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
            # The plugin fills artist/track only when the title was empty, so
            # the title check covers them; the year check covers the unpacking.
            repaired = (item.title and not current.title) or (
                item.year and current.year != item.year
            )
            if repaired and item.try_write():
                written += 1
    finally:
        lib._close()
    if written:
        protocol.log(f"import: repaired tags written into {written} file(s)")


def _shrink_covers(request_id: str, params: dict) -> int:
    """Give every album a cover the interface can draw.

    Two repairs in one walk. An album with no art file gets the image its own
    tracks carry (`_adopt_embedded_cover`) — a hand-fed library often has its
    cover *inside* the files and nothing beside them, and the interface only
    ever reads the folder's file. Then every oversized cover gets a small
    rendition: an imported cover is whatever the folder had, 5000x5000 is
    ordinary, and drawing it means decoding 100 MB of pixels for a 40 px
    thumbnail. The download path never pays either cost because it writes its
    own 500 px file; imports had no such step, so this is it.

    Over every album, not only the ones just imported: beets records nothing
    about which those were, both checks are cheap on an album already served
    (no artpath probe, one image-header read), and re-running is a no-op —
    which is what makes the pass safe to repeat after each import.
    """
    from beets.library import Library

    import covers
    import enrich

    lib = Library(params["beets_db"], directory=params["library_dir"])
    try:
        albums = list(lib.albums())
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
    """Give an artless album the image its own tracks carry, if any do.

    First image of the first item holding one: embedded copies are the same
    picture in the overwhelming case, and the album has exactly one art slot.
    Staged beside the tracks and handed to `set_art`, which files it under
    beets' own `cover.*` name — the slot the interface reads — and records it
    as the album's artpath.
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
