"""Write-time provenance traces, as beets flexible attributes.

Most of a track's history can be rebuilt after the fact: `mb_trackid` proves a
MusicBrainz match ever landed, `sonarche_provisional` marks guessed tags. Two
things exist only at write time and are lost forever if not recorded then —
*how* a match was found (fingerprint vs text search) and *what a human edited
by hand*. This module records them; the sidecar never reads them back (they
are for the front's provenance funnel and for `beet ls` forensics).

Callers own the `item.store()`: marking mutates the in-memory item only, so a
path that already stores keeps its single write.
"""

from datetime import datetime, timezone

# 1 once a Chromaprint was computed for the file, whether or not it matched —
# the funnel's "fingerprinted" stage.
FINGERPRINTED = "sonarche_fingerprinted"
# How the applied MusicBrainz match was found: "acoustid" (fingerprint-anchored,
# trusted) or "text" (name search, conservative fallback).
MATCH_SOURCE = "sonarche_match_source"
# Last manual edit (UTC, ISO 8601) and the union of every field a human ever
# touched — the one signal that cannot be reconstructed retroactively.
EDITED_AT = "sonarche_edited_at"
EDITED_FIELDS = "sonarche_edited_fields"

_FIELDS_DELIMITER = ","


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def mark_fingerprinted(item) -> None:
    item[FINGERPRINTED] = 1


def mark_match(item, source: str) -> None:
    item[MATCH_SOURCE] = source


def mark_edited(item, fields, now: str | None = None) -> None:
    """Record a manual edit of `fields` (beets attribute names).

    `EDITED_FIELDS` accumulates across edits — editing the year and later the
    genre leaves both on record — because the point is "which values did a
    human vouch for", not "what moved last time"."""
    item[EDITED_AT] = now or _utc_now()
    previous = str(item.get(EDITED_FIELDS) or "")
    known = {field for field in previous.split(_FIELDS_DELIMITER) if field}
    item[EDITED_FIELDS] = _FIELDS_DELIMITER.join(sorted(known | set(fields)))
