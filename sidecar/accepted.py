"""Checks whose verdict the owner has already heard, and answered.

The metadata page is a list of things Sonarche noticed. Some of them are not
defects at all: a rip with no release year, a genre the app's tree has never
heard of, two versions of a track someone keeps on purpose. Until now the only
way to make such a line go away was to change the file to something it was not,
so the count never reached zero and a number that can never reach zero reads as
a reproach rather than an offer.

Accepting is the other answer. It says "I have seen it, it is what I want", and
it takes the object out of that check for good — the count goes down without a
single tag being rewritten, which is the whole point.

Stored per object and per check, never as a global "stop checking years": a
library gains tracks, and a future import's untagged rips must still be
mentioned. A comma-joined list on beets' own flexible attribute — items for the
track checks, albums for the cover — because the set is tiny, read on every
listing, and never queried by value.
"""

import os

import protocol

# Same word on both tables. Which one is read is decided by the check, not by
# the key, and a single name keeps the two halves obviously the same idea.
KEY = "sonarche_accepted"

# Only what a person can legitimately mean to leave as it is. `suspect` is
# absent on purpose — a match flagged as contradicting its own download is a
# question about what the audio *is*, and the answer is to look, not to accept.
# `tracklist` is absent too: a record with no tracklist is a collection, which
# says so once and for the whole record (see `album_kind.py`).
TRACK_CHECKS = ("year", "track", "genre", "duplicates")
ALBUM_CHECKS = ("artwork",)


def parse(stored) -> set[str]:
    """The stored list as a set. Pure. Anything unreadable is an empty set —
    a corrupt value must never make an object look accepted."""
    if not stored or not isinstance(stored, str):
        return set()
    return {part.strip() for part in stored.split(",") if part.strip()}


def join(checks) -> str:
    """The canonical stored form: sorted and comma-joined, so the same set is
    always the same string and an unchanged write is detectably unchanged."""
    return ",".join(sorted(checks))


def next_value(stored, check: str, accepted: bool) -> str | None:
    """The value to store, or None when the attribute should be removed. Pure.

    None rather than an empty string: an object that accepts nothing is the
    default, and a row saying so is a row that outlives its meaning.
    """
    current = parse(stored)
    if accepted:
        current.add(check)
    else:
        current.discard(check)
    return join(current) or None


def handle(_request_id: str, params: dict) -> dict:
    """Accept (or un-accept) one check across a batch of tracks or albums."""
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
            # Database only, like the record's kind: this is Sonarche's memory
            # of a conversation with its user, not a tag any other player could
            # read. Writing it would edit N files to say nothing they can carry.
            obj.store()
            updated += 1
    finally:
        lib._close()

    protocol.log(f"accepted: {check} {'set' if accepted else 'cleared'} on {updated} {scope}(s)")
    return {"updated": updated}
