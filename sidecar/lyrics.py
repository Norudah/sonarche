"""One track's lyrics, from LRCLIB then lyrics.ovh.

Opening the panel reads only what the library holds; the network is used
only when the user asks.

- LRCLIB serves timed (LRC) and plain lyrics, matching on artist, title,
  album and duration.
- lyrics.ovh is plain-text only, matching on artist and title; it's the
  fallback when LRCLIB has nothing or is down.
"""

import re
from urllib.parse import quote

import protocol

_API = "https://lrclib.net/api"
_OVH_API = "https://api.lyrics.ovh/v1"
# LRCLIB sometimes completes TLS and then never answers.
_TIMEOUT = 8


class ServiceUnavailable(Exception):
    """A lyrics service did not answer (distinct from a connection problem)."""

# No tag format holds LRC, so timed lyrics live only in the DB.
SYNCED_KEY = "sonarche_lyrics_synced"
# Which service answered: a plain lyrics.ovh result is worth retrying.
SOURCE_KEY = "sonarche_lyrics_source"

# `[mm:ss.xx]`, `[mm:ss:xx]` or `[mm:ss]`, repeatable at the head of a line.
_STAMP = re.compile(r"\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]")

# Mirrors LRCLIB's own /api/get tolerance.
_DURATION_TOLERANCE = 3.0


def parse_lrc(text: str) -> list[dict]:
    """LRC text -> `[{"time": seconds, "text": …}]`, in time order.

    Header tags never match `_STAMP` and drop out. Timed blank lines are kept
    as pauses between verses."""
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
    """The plain text of an LRC body, for the file tag."""
    return "\n".join(line["text"] for line in parse_lrc(text))


def pick_candidate(candidates: list[dict], duration: float | None) -> dict | None:
    """The best `/api/search` hit, or nothing.

    Hits whose length disagrees with the file are dropped (wrong lyrics are
    worse than none); among the rest, timed beats plain."""
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
    """One LRCLIB call; network failures become `ServiceUnavailable`."""
    import requests

    try:
        return requests.get(url, params=params, headers=headers, timeout=_TIMEOUT)
    except requests.exceptions.RequestException as exc:
        raise ServiceUnavailable(str(exc)) from exc


def _lookup_ovh(item, user_agent: str) -> str | None:
    """Plain text from lyrics.ovh, or nothing. Without a duration to check, it
    may return a cover or a same-titled song, hence second in line."""
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

    # /api/get needs all four fields to match; search on artist and title and
    # let the duration decide.
    protocol.log(f"lyrics: no exact match for {artist} - {title}, searching")
    response = _get(f"{_API}/search", {"track_name": title, "artist_name": artist}, headers)
    if response.status_code != 200:
        raise ServiceUnavailable(f"lrclib answered {response.status_code}")
    return pick_candidate(response.json(), duration)


def fetch(_request_id: str, params: dict) -> dict:
    """Lyrics for one item: stored ones first, the network only when asked.
    Misses are not cached."""
    from beets.library import Library

    lib = Library(params["beets_db"], directory=params["library_dir"])
    item = lib.get_item(params["item_id"])
    if item is None:
        raise RuntimeError("track not found")

    plain = str(item.get("lyrics") or "").strip()
    synced = str(item.get(SYNCED_KEY) or "").strip()
    # `force` skips the stored answer without erasing it.
    if (plain or synced) and not params.get("force"):
        return _payload(str(item.get(SOURCE_KEY) or "") or "library", plain, synced)
    if not params.get("allow_network"):
        return _payload(None, "", "")
    plain = synced = ""

    user_agent = params["user_agent"]
    source = None
    # Reported only if neither source returns lyrics.
    unreachable = False

    try:
        found = _lookup(item, user_agent)
    except ServiceUnavailable as exc:
        protocol.log(f"lyrics: lrclib unreachable ({exc})")
        found, unreachable = None, True

    if found is not None:
        # An instrumental is a real answer: stop here.
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
        # A fruitless retry keeps what was stored.
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
