"""Checks the user has accepted as intended ("c'est voulu").

Accepting removes an object from one check without rewriting any tag. Stored
per object and per check as a comma-joined flexible attribute (on items for
track checks, on albums for the cover check).
"""

import os

import protocol

# Same key on items and albums; the check decides which is read.
KEY = "sonarche_accepted"

# `suspect` needs a look, not an acceptance; `tracklist` is handled by the
# album kind (see `album_kind.py`).
TRACK_CHECKS = ("year", "track", "genre", "duplicates")
ALBUM_CHECKS = ("artwork",)


def parse(stored) -> set[str]:
    """The stored list as a set; anything unreadable is empty."""
    if not stored or not isinstance(stored, str):
        return set()
    return {part.strip() for part in stored.split(",") if part.strip()}


def join(checks) -> str:
    """Canonical form: sorted and comma-joined."""
    return ",".join(sorted(checks))


def next_value(stored, check: str, accepted: bool) -> str | None:
    """The value to store, or None to remove the attribute."""
    current = parse(stored)
    if accepted:
        current.add(check)
    else:
        current.discard(check)
    return join(current) or None


def handle(_request_id: str, params: dict) -> dict:
    """Accept or un-accept one check across a batch of tracks or albums."""
    scope = params["scope"]
    check = params["check"]
    accepted = bool(params["accepted"])
    valid = TRACK_CHECKS if scope == "track" else ALBUM_CHECKS if scope == "album" else ()
    if check not in valid:
        raise RuntimeError(f"unknown {scope} check: {check}")

    ids = [int(value) for value in params.get("ids") or []]
    if not ids:
        return {"updated": 0}

    db_path = params["beets_db"]
    if not os.path.exists(db_path):
        raise RuntimeError("library not found")

    from beets.library import Library

    lib = Library(db_path, directory=params["library_dir"])
    updated = 0
    try:
        for entity_id in ids:
            obj = lib.get_item(entity_id) if scope == "track" else lib.get_album(entity_id)
            if obj is None:
                continue
            wanted = next_value(obj.get(KEY), check, accepted)
            if (obj.get(KEY) or None) == wanted:
                continue
            if wanted is None:
                try:
                    del obj[KEY]
                except KeyError:
                    continue
            else:
                obj[KEY] = wanted
            # App-only attribute, not written to tags.
            obj.store()
            updated += 1
    finally:
        lib._close()

    protocol.log(f"accepted: {check} {'set' if accepted else 'cleared'} on {updated} {scope}(s)")
    return {"updated": updated}
