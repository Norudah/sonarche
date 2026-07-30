"""Is each outside service the app leans on actually answering right now?

The app talks to six services it does not own, and when one of them goes quiet
the symptom always shows up somewhere else: an import with no cover, a genre
pass that finds nothing, lyrics that come back as plain text because the
synchronised source timed out. That happened for real (LRCLIB accepting the TLS
handshake and then sending nothing), and the only way to tell it from a bug in
Sonarche was to reach for a terminal.

So: one button, six answers, in the app.

The probes are deliberately the cheapest request each service will answer, and
they are only ever fired when the user asks. A health check that polled would
be one more impolite client, which is the exact thing the rate-limit screen
next door exists to prevent.
"""

from concurrent.futures import ThreadPoolExecutor

import protocol

# Short: this screen is answering "is it up", and a service that needs more
# than this to say hello is not usable for an import anyway.
_TIMEOUT = 8

# MusicBrainz requires a real User-Agent and blocks the default one; the others
# do not care, and sending the same string everywhere keeps us identifiable.
_USER_AGENT = "Sonarche/1.0 ( https://github.com/Norudah/sonarche )"

# A known-good MusicBrainz release id (Nirvana — Nevermind), used only as a
# cheap thing to ask for. Any stable id would do; the answer is discarded.
_RELEASE = "76df3287-6cda-33eb-8e9a-044b5e15ffdd"

# The order is the order the panel lists them in: identification first, then
# what decorates a release, then the two lyrics sources.
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

    Pure, because the three cases are the whole point and each one means
    something different to the user:

    * `up` — anything under 500. A 4xx is the *service* telling us our
      deliberately incomplete probe was incomplete, which is an answer.
    * `down` — a 5xx. It is there, it is broken, waiting will help.
    * `unreachable` — nothing came back at all: no route, no DNS, no bytes
      after the handshake. Indistinguishable, from here, from the user's own
      connection being off — so the wording must not accuse either one.
    """
    if failure is not None:
        return {"state": "unreachable", "detail": failure}
    if status is None:
        return {"state": "unreachable", "detail": None}
    if status >= 500:
        return {"state": "down", "detail": str(status)}
    return {"state": "up", "detail": str(status)}


def _probe(name: str, url: str) -> dict:
    import requests

    try:
        resp = requests.get(
            url, timeout=_TIMEOUT, headers={"User-Agent": _USER_AGENT}
        )
        verdict = classify(resp.status_code, None)
    except Exception as exc:  # noqa: BLE001 — every failure is the same verdict
        verdict = classify(None, type(exc).__name__)
    return {"name": name, **verdict}


def check(request_id: str, params: dict) -> dict:
    """Probe every service, or the one named in `params`."""
    only = params.get("only")
    probes = [p for p in PROBES if only is None or p[0] == only]
    if not probes:
        raise ValueError(f"unknown service: {only}")

    protocol.log(f"services: probing {', '.join(name for name, _ in probes)}")
    # In parallel, so six services with an 8s timeout cannot add up to 48s of
    # the user staring at spinners.
    with ThreadPoolExecutor(max_workers=len(probes)) as pool:
        results = list(pool.map(lambda p: _probe(*p), probes))
    return {"services": results}
