"""One track's lyrics, from LRCLIB and then from lyrics.ovh.

Per track and per gesture, never as a pass over the library: lyrics are what a
listener asks for on one song, so there is nothing here to batch and nothing to
pace. The two modes are the two moments in the UI — opening the panel answers
from what the library already holds and touches no network at all, pressing the
button is the only thing that leaves the machine.

Two sources, in this order and for two different reasons:

- LRCLIB is a community database that serves *timed* lyrics (LRC) beside the
  plain text, and matches on artist, title, album and duration. It is the one
  that can make the panel follow the music, so it is asked first.
- lyrics.ovh knows plain text only and matches on artist and title alone. It is
  asked when LRCLIB has nothing or is not answering — a page of words with no
  timing beats an empty panel, and the two go down independently.

Neither needs a key or an account. We ask for one track, store the answer on the
user's own file, and redistribute nothing.
"""

import re
from urllib.parse import quote

import protocol

_API = "https://lrclib.net/api"
_OVH_API = "https://api.lyrics.ovh/v1"
# Short on purpose. When LRCLIB is having a bad day it does not refuse the
# connection — it completes the TLS handshake and then never sends a byte, so
# the only thing standing between the reader and a frozen button is this
# number. A healthy answer comes back in well under a second.
_TIMEOUT = 8


class ServiceUnavailable(Exception):
    """A lyrics service did not answer.

    Its own failure, not the user's: worth a sentence of its own in the panel,
    because "check your connection" sends someone to look at a router over a
    service that is simply down."""

# The timed lyrics, kept as a flexible attribute: no tag format has a home for
# an LRC body, so unlike `lyrics` this one never reaches the file.
SYNCED_KEY = "sonarche_lyrics_synced"
# Which service answered. Recorded because the panel is asked it every time it
# reopens — without this, everything stored reads as "came from somewhere", and
# the reader cannot tell a timed LRCLIB page from a plain lyrics.ovh one that is
# worth asking again for.
SOURCE_KEY = "sonarche_lyrics_source"

# `[mm:ss.xx]`, `[mm:ss:xx]` or `[mm:ss]`, repeatable at the head of a line —
# LRC repeats a chorus line once per timestamp it belongs to.
_STAMP = re.compile(r"\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]")

# How far a search hit's length may sit from the file's before it stops being
# the same recording. LRCLIB's own /api/get tolerance, which we mirror.
_DURATION_TOLERANCE = 3.0


def parse_lrc(text: str) -> list[dict]:
    """LRC text -> `[{"time": seconds, "text": …}]`, in time order.

    Header tags (`[ar:…]`, `[length:…]`) fall out on their own: none of them
    matches `_STAMP`, which wants digits either side of the colon. Timed blank
    lines are kept — they are a beat between two verses, and dropping them
    reflows a song into one wall of text."""
    lines: list[dict] = []
    for raw in text.splitlines():
        stamps = list(_STAMP.finditer(raw))
        if not stamps:
            continue
        body = raw[stamps[-1].end() :].strip()
        for stamp in stamps:
            minutes, seconds, fraction = stamp.groups()
            at = int(minutes) * 60 + int(seconds)
            if fraction:
                at += int(fraction) / (10 ** len(fraction))
            lines.append({"time": round(at, 3), "text": body})
    lines.sort(key=lambda line: line["time"])
    return lines


def strip_stamps(text: str) -> str:
    """The readable text inside an LRC body, for the file tag — which has no
    notion of timing and would otherwise show the timestamps to every other
    player."""
    return "\n".join(line["text"] for line in parse_lrc(text))


def pick_candidate(candidates: list[dict], duration: float | None) -> dict | None:
    """The best of `/api/search`'s hits, or nothing.

    Search matches on names alone, so one title happily returns the album cut,
    a live version and a 30-second preview. Length is the only thing in the
    payload that tells them apart: a hit that disagrees with the file is
    dropped outright rather than ranked lower, because the wrong lyrics are
    worse than none. Among the survivors, timed wins over plain — the timing is
    the whole point of the panel."""
    usable = [c for c in candidates if c.get("plainLyrics") or c.get("syncedLyrics")]
    if duration:
        usable = [c for c in usable if abs((c.get("duration") or 0) - duration) <= _DURATION_TOLERANCE]
    if not usable:
        return None
    return min(
        usable,
        key=lambda c: (0 if c.get("syncedLyrics") else 1, abs((c.get("duration") or 0) - (duration or 0))),
    )


def _payload(
    source: str | None, plain: str, synced: str, instrumental: bool = False, unreachable: bool = False
) -> dict:
    return {
        "source": source,
        "plain": plain or None,
        "lines": parse_lrc(synced) if synced else [],
        "instrumental": instrumental,
        "unreachable": unreachable,
    }


def _get(url: str, params: dict | None, headers: dict):
    """One call to LRCLIB, with its failures named.

    Every way the network can go wrong — DNS, refused, timed out mid-read —
    arrives here as a `RequestException`, and none of them says anything about
    this track. They are one condition to the reader ("the service is not
    answering"), so they become one exception rather than a traceback."""
    import requests

    try:
        return requests.get(url, params=params, headers=headers, timeout=_TIMEOUT)
    except requests.exceptions.RequestException as exc:
        raise ServiceUnavailable(str(exc)) from exc


def _lookup_ovh(item, user_agent: str) -> str | None:
    """The plain text, from lyrics.ovh, or nothing.

    Artist and title are all it takes, and all it accepts: there is no duration
    to arbitrate with, so a cover or a same-titled song can come back instead of
    the record. That is the price of the fallback, and it is why this one is
    second — the words are usually right where the timing would not have been."""
    title = item.title or ""
    artist = item.artist or ""
    if not title or not artist:
        return None

    response = _get(f"{_OVH_API}/{quote(artist, safe='')}/{quote(title, safe='')}", None, {"User-Agent": user_agent})
    if response.status_code == 404:
        return None
    if response.status_code != 200:
        raise ServiceUnavailable(f"lyrics.ovh answered {response.status_code}")
    return (response.json().get("lyrics") or "").strip() or None


def _lookup(item, user_agent: str) -> dict | None:
    headers = {"User-Agent": user_agent}
    title = item.title or ""
    artist = item.artist or ""
    if not title:
        return None
    duration = float(item.length or 0) or None

    query = {"track_name": title, "artist_name": artist, "album_name": item.album or ""}
    if duration:
        query["duration"] = int(round(duration))
    response = _get(f"{_API}/get", query, headers)
    if response.status_code == 200:
        return response.json()
    if response.status_code != 404:
        raise ServiceUnavailable(f"lrclib answered {response.status_code}")

    # /api/get wants all four fields to agree, so a tag that is merely close —
    # "… feat. X" on the artist, a deluxe edition's album name — misses a track
    # the database plainly has. Search asks on the two fields we trust most and
    # lets the duration arbitrate.
    protocol.log(f"lyrics: no exact match for {artist} - {title}, searching")
    response = _get(f"{_API}/search", {"track_name": title, "artist_name": artist}, headers)
    if response.status_code != 200:
        raise ServiceUnavailable(f"lrclib answered {response.status_code}")
    return pick_candidate(response.json(), duration)


def fetch(_request_id: str, params: dict) -> dict:
    """Lyrics for one item, from the library first and the network only if asked.

    A miss is not cached. The database gains tracks every day and the user is
    one button press away from asking again, so remembering "not found" would
    only turn today's gap into a permanent one."""
    from beets.library import Library

    lib = Library(params["beets_db"], directory=params["library_dir"])
    item = lib.get_item(params["item_id"])
    if item is None:
        raise RuntimeError("track not found")

    plain = str(item.get("lyrics") or "").strip()
    synced = str(item.get(SYNCED_KEY) or "").strip()
    # `force` is the panel's "look again": the stored answer is skipped, not
    # erased — if the second look finds nothing, what is on disk stays there.
    if (plain or synced) and not params.get("force"):
        return _payload(str(item.get(SOURCE_KEY) or "") or "library", plain, synced)
    if not params.get("allow_network"):
        return _payload(None, "", "")
    plain = synced = ""

    user_agent = params["user_agent"]
    source = None
    # A service being down is an answer, not a crash: it comes back as a state
    # the panel can name, rather than as a traceback the front can only call
    # "something went wrong". Tracked across both sources, and only reported if
    # neither of them ends up with words.
    unreachable = False

    try:
        found = _lookup(item, user_agent)
    except ServiceUnavailable as exc:
        protocol.log(f"lyrics: lrclib unreachable ({exc})")
        found, unreachable = None, True

    if found is not None:
        # An instrumental is a real answer, and the only one lyrics.ovh could
        # add to it is the wrong song's words. The chain stops here.
        if found.get("instrumental"):
            return _payload("lrclib", "", "", instrumental=True)
        plain = (found.get("plainLyrics") or "").strip()
        synced = (found.get("syncedLyrics") or "").strip()
        if plain or synced:
            source = "lrclib"

    if source is None:
        try:
            fallback = _lookup_ovh(item, user_agent)
        except ServiceUnavailable as exc:
            protocol.log(f"lyrics: lyrics.ovh unreachable ({exc})")
            fallback = None
            unreachable = True
        if fallback:
            plain, source = fallback, "lyrics.ovh"

    if source is None:
        if not unreachable:
            protocol.log(f"lyrics: nothing for {item.artist} - {item.title}")
        # A fruitless second look must not wipe the first one: re-read what is
        # on disk and hand that back, so "look again" can only ever add.
        kept = str(item.get("lyrics") or "").strip()
        if kept:
            return _payload(str(item.get(SOURCE_KEY) or "") or "library", kept, str(item.get(SYNCED_KEY) or "").strip())
        return _payload(None, "", "", unreachable=unreachable)

    item.lyrics = plain or strip_stamps(synced)
    item[SYNCED_KEY] = synced
    item[SOURCE_KEY] = source
    item.store()
    try:
        item.write()
    except Exception as exc:  # DB is authoritative; file tags are best-effort
        protocol.log(f"lyrics: tag write failed: {exc}")
    protocol.log(f"lyrics: {item.artist} - {item.title} <- {source} ({'timed' if synced else 'plain'})")
    return _payload(source, item.lyrics, synced)
