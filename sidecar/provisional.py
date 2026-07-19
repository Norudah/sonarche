"""Last-resort metadata for a file nothing could identify.

When the fingerprint resolves no recording and the text search no release, the
item keeps the blank tags its as-is import gave it: no title, no album, and a
destination path outside any album folder. That file is effectively lost — it
is on disk and in the library, but the user has no way to find it.

Rather than leave it blank, fill it from what the download already knew (the
video title, the uploader) and, in album mode, from the release its siblings
did match. None of that is verified, so every item filled this way carries the
`sonarche_provisional` flag: the library stays honest about which tags are
evidence and which are guesses, and `beet ls sonarche_provisional:1` lists
everything still waiting for a real pass.

The track number is never guessed. A playlist position is not a track number,
and a wrong one silently reorders the album for good."""

FLAG = "sonarche_provisional"

# Release-level tags a sibling can borrow: they describe the album, not the
# track, so they hold for any file that belongs to it. `track`/`title` are
# deliberately absent — those are per-track truths nobody voted on.
_BORROWED = (
    "album",
    "albumartist",
    "year",
    "month",
    "day",
    "mb_albumid",
    "mb_releasegroupid",
    "genres",
)


def album_fields(album) -> dict:
    """The borrowable tags of a matched album row."""
    return {key: album.get(key) for key in _BORROWED}


def guess_fields(
    title: str | None = None,
    artist: str | None = None,
    album_fields: dict | None = None,
) -> dict:
    """The tags to write on an item nothing identified. Pure.

    `title`/`artist` come from the download itself; `album_fields` from the
    release the siblings matched. Empty values are dropped — a guess must never
    overwrite an existing tag with nothing."""
    fields: dict = {}
    if title:
        fields["title"] = title
    if artist:
        fields["artist"] = artist
    for key in _BORROWED:
        value = (album_fields or {}).get(key)
        if value:
            fields[key] = value
    return fields


def apply(item, fields: dict) -> bool:
    """Write the guessed tags and raise the flag. Returns False when there was
    nothing to guess: an item with no hints at all stays untouched rather than
    gaining a flag that promises tags it doesn't have."""
    if not fields:
        return False
    for key, value in fields.items():
        item[key] = value
    # The album path parks the playlist position in `track` in memory to help
    # the text search. It must not reach the database from here: that position
    # is not a track number.
    item.track = 0
    item[FLAG] = 1
    return True
