"""Write-time provenance, as beets flexible attributes.

Records what cannot be reconstructed later: how a match was found and which
fields a human edited (so bulk passes can spare them). Only the in-memory
item is mutated; callers own `item.store()`.
"""

from datetime import datetime, timezone

# 1 once a Chromaprint was computed, whether or not it matched.
FINGERPRINTED = "sonarche_fingerprinted"
# "acoustid" (fingerprint) or "text" (name search fallback).
MATCH_SOURCE = "sonarche_match_source"
# Last manual edit (UTC, ISO 8601) and every field a human ever touched.
EDITED_AT = "sonarche_edited_at"
EDITED_FIELDS = "sonarche_edited_fields"

_FIELDS_DELIMITER = ","


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def mark_fingerprinted(item) -> None:
    item[FINGERPRINTED] = 1


def mark_match(item, source: str) -> None:
    item[MATCH_SOURCE] = source


def was_hand_edited(item, field: str) -> bool:
    """Whether a human ever edited `field` on this item."""
    recorded = str(item.get(EDITED_FIELDS) or "")
    return field in recorded.split(_FIELDS_DELIMITER)


def mark_edited(item, fields, now: str | None = None) -> None:
    """Record a manual edit of `fields`. `EDITED_FIELDS` accumulates across edits."""
    item[EDITED_AT] = now or _utc_now()
    previous = str(item.get(EDITED_FIELDS) or "")
    known = {field for field in previous.split(_FIELDS_DELIMITER) if field}
    item[EDITED_FIELDS] = _FIELDS_DELIMITER.join(sorted(known | set(fields)))
