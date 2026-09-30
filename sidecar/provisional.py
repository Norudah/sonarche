"""Last-resort metadata for a file nothing could identify.

The item is filled from the download hints (video title, uploader) and, in
album mode, from the release its siblings matched, then flagged
`sonarche_provisional` (`beet ls sonarche_provisional:1` lists them).

The track number is never guessed: a playlist position is not one."""

FLAG = "sonarche_provisional"

# Album-level tags, valid for any track of the album.
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
    return {key: album.get(key) for key in _BORROWED}


def guess_fields(
    title: str | None = None,
    artist: str | None = None,
    album_fields: dict | None = None,
) -> dict:
    """Tags for an unidentified item. Empty values are dropped so a guess never
    blanks an existing tag."""
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


def clear(item) -> bool:
    """Clear the flag after a real match. In-memory only. Returns whether it was set."""
    if item.get(FLAG):
        del item[FLAG]
        return True
    return False


def apply(item, fields: dict) -> bool:
    """Write the guessed tags and set the flag. Returns False when there is
    nothing to guess."""
    if not fields:
        return False
    for key, value in fields.items():
        item[key] = value
    # The album path parks the playlist position in `track`; don't persist it.
    item.track = 0
    item[FLAG] = 1
    return True
