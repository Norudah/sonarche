"""One-shot removal of the `cover-hq.*` archives Sonarche <= 2.x kept.

Run once per install (guarded by a marker file). Only deletes files with
the archive prefix, in folders the beets database points at.
"""

import os
import sqlite3

import covers
import protocol
from library import expand_db_path


def handle(_request_id: str, params: dict) -> dict:
    db_path = params["beets_db"]
    if not os.path.exists(db_path):
        return {"removed": 0, "folders": 0}

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=20.0)
    try:
        rows = conn.execute("SELECT artpath FROM albums WHERE artpath IS NOT NULL").fetchall()
    finally:
        conn.close()

    removed = 0
    seen: set[str] = set()
    for (stored,) in rows:
        art = expand_db_path(stored, params["library_dir"])
        if not art:
            continue
        art_dir = os.path.dirname(art)
        if art_dir in seen:
            continue
        seen.add(art_dir)
        removed += covers.remove_legacy_archives(art_dir)

    if removed:
        protocol.log(f"cover_cleanup: {removed} legacy archive(s) removed across {len(seen)} folder(s)")
    return {"removed": removed, "folders": len(seen)}
