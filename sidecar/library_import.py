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
import sys

import protocol


def _beet_bin() -> str:
    return os.path.join(os.path.dirname(sys.executable), "beet")


def handle(request_id: str, params: dict) -> dict:
    folder = params["folder"]
    config_path = params["beets_config"]
    if not os.path.isdir(folder):
        raise RuntimeError(f"folder not found: {folder}")

    cmd = [_beet_bin(), "--config", config_path, "import",
           "--quiet", "--quiet-fallback=asis", "-A", "-M", "-c", folder]

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
    if code != 0:
        raise RuntimeError(f"beet import failed (exit {code}): {' / '.join(tail)[:500]}")

    return {"folders": folders, "renditions": _shrink_covers(request_id, params)}


def _shrink_covers(request_id: str, params: dict) -> int:
    """Give every oversized cover a small rendition to be drawn from.

    An imported album keeps whatever cover its folder had — 5000x5000 is
    ordinary — and that file lands in the slot the interface reads. Drawing it
    means decoding it whole: 100 MB of pixels for a 40 px thumbnail. A
    downloaded album never pays that because the download path writes a 500 px
    rendition; imports had no such step, so this is it.

    Over every album, not only the ones just imported: beets records nothing
    about which those were, the check is a header read, and an album already
    holding a rendition costs one `sips -g` to skip. Re-running is a no-op,
    which is what makes it safe to do after each import.
    """
    from beets.library import Library

    import covers
    import enrich

    lib = Library(params["beets_db"], directory=params["library_dir"])
    try:
        albums = [a for a in lib.albums() if a.artpath]
        total = len(albums)
        made = 0
        for index, album in enumerate(albums, start=1):
            if covers.ensure_display_rendition(enrich._decode(album.artpath)):
                made += 1
            protocol.send_event(
                request_id,
                "library_covers_progress",
                {"done": index, "total": total, "renditions": made},
            )
        return made
    finally:
        lib._close()
