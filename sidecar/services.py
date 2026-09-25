"""Health check of the external services the app depends on.

Each probe is the cheapest request the service will answer, and runs only on
user request.
"""

from concurrent.futures import ThreadPoolExecutor

import protocol

_TIMEOUT = 8

# MusicBrainz blocks the default User-Agent. The caller passes one built from
# the app version; this is a fallback for direct calls.
_FALLBACK_USER_AGENT = "Sonarche (https://github.com/Norudah/sonarche)"

# Any stable release id (Nirvana - Nevermind); the answer is discarded.
_RELEASE = "76df3287-6cda-33eb-8e9a-044b5e15ffdd"

# Display order.
PROBES: list[tuple[str, str]] = [
    ("musicbrainz", f"https://musicbrainz.org/ws/2/release/{_RELEASE}?fmt=json"),
    ("acoustid", "https://api.acoustid.org/v2/lookup?client=&format=json"),
    ("coverart", f"https://coverartarchive.org/release/{_RELEASE}"),
    ("lastfm", "https://ws.audioscrobbler.com/2.0/?method=track.getInfo&format=json"),
    ("lrclib", "https://lrclib.net/api/search?q=hello"),
    ("lyricsovh", "https://api.lyrics.ovh/v1/queen/bohemian%20rhapsody"),
]


def classify(status: int | None, failure: str | None) -> dict:
    """A probe's outcome as a verdict.

    * `up`: any status below 500 (a 4xx answers our incomplete probe).
    * `down`: a 5xx.
    * `unreachable`: no response at all, indistinguishable from the user being
      offline.
    """
    if failure is not None:
        return {"state": "unreachable", "detail": failure}
    if status is None:
        return {"state": "unreachable", "detail": None}
    if status >= 500:
        return {"state": "down", "detail": str(status)}
    return {"state": "up", "detail": str(status)}


def _probe(name: str, url: str, user_agent: str) -> dict:
    import requests

    try:
        resp = requests.get(url, timeout=_TIMEOUT, headers={"User-Agent": user_agent})
        verdict = classify(resp.status_code, None)
    except Exception as exc:  # noqa: BLE001 — every failure is the same verdict
        verdict = classify(None, type(exc).__name__)
    return {"name": name, **verdict}


def check(request_id: str, params: dict) -> dict:
    only = params.get("only")
    user_agent = params.get("user_agent") or _FALLBACK_USER_AGENT
    probes = [p for p in PROBES if only is None or p[0] == only]
    if not probes:
        raise ValueError(f"unknown service: {only}")

    protocol.log(f"services: probing {', '.join(name for name, _ in probes)}")
    # In parallel, so timeouts don't add up.
    with ThreadPoolExecutor(max_workers=len(probes)) as pool:
        results = list(pool.map(lambda p: _probe(*p, user_agent), probes))
    return {"services": results}
