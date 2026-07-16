"""Propose rich metadata candidates for a single track via the beets API (read-only).

The library importer only ever gets a lone file, so album-level autotag is hopeless
(a 1-track "album" is penalised against full releases). Instead we identify the
*recording* (singleton search), then resolve each recording to a concrete *release*
so we can surface album, year, track number and cover art. The user picks; nothing is
written here."""

import protocol

# beets plugins must be loaded once before autotag can reach any metadata source.
_loaded = False

# How many recording matches to resolve; each costs MusicBrainz calls (rate-limited).
_MAX_CANDIDATES = 4

# Release-group primary types, best first, for picking a recording's canonical release.
_PRIMARY_RANK = {"Album": 0, "EP": 1, "Single": 2, "Broadcast": 3, "Other": 4}
# Secondary types mark non-canonical releases (best-of, live, remix collections).
# Any of these pushes a release below clean studio releases, so a recording that
# also lives on a compilation ("Made in Germany 1995–2011") resolves to its album.
_UNWANTED_SECONDARY = frozenset({
    "Compilation", "Live", "Remix", "DJ-mix", "Mixtape/Street", "Demo",
    "Soundtrack", "Interview", "Audiobook", "Audio drama", "Spokenword",
    "Field recording",
})


def ensure_plugins():
    """Load the plugins declared in the beets config.

    The Rust host sets BEETSDIR, so the in-process config is the very
    config.yaml `write_beets_config()` regenerates on every launch — one
    config site, nothing redefined programmatically here."""
    global _loaded
    if _loaded:
        return
    from beets import plugins

    plugins.load_plugins()
    _loaded = True


def mb_plugin():
    import beets.metadata_plugins as mp

    sources = mp.find_metadata_source_plugins()
    if not sources:
        raise RuntimeError("no metadata source plugin loaded")
    return sources[0]


def lastgenre_plugin():
    import beets.plugins as plugins

    for plugin in plugins.find_plugins():
        if plugin.name == "lastgenre":
            return plugin
    raise RuntimeError("lastgenre not loaded")


def release_rank(release: dict) -> tuple:
    """Sort key: lower is better. Studio album beats single beats compilation/
    live/remix; earliest date breaks ties (original over reissue). Also used to
    compare picks across the several recordings one fingerprint resolves to."""
    rg = release.get("release_group") or {}
    secondary = rg.get("secondary_types") or []
    unwanted = any(s in _UNWANTED_SECONDARY for s in secondary)
    return (unwanted, _PRIMARY_RANK.get(rg.get("primary_type"), 5), release.get("date") or "9999")


def pick_release(releases: list) -> dict | None:
    """Pick a recording's canonical release: an official studio album, not a
    best-of/live/remix, earliest date winning (original over reissue). Requires
    the recording lookup to include `release-groups`, else every type ranks equal
    and it degrades to earliest-date."""
    if not releases:
        return None
    official = [r for r in releases if r.get("status") == "Official"] or releases
    return sorted(official, key=release_rank)[0]


def _candidate_from_recording(plugin, rec_id: str, match_pct: int) -> dict | None:
    rec = plugin.mb_api.get_recording(rec_id, includes=["releases", "release-groups"])
    release = pick_release(rec.get("releases", []) if isinstance(rec, dict) else [])
    if not release:
        return None

    album = plugin.album_for_id(release["id"])
    if not album:
        return None

    ours = next((t for t in album.tracks if t.track_id == rec_id), None)
    return {
        "recording_id": rec_id,
        "release_id": release["id"],
        "match": match_pct,
        "title": ours.title if ours else None,
        "artist": album.artist,
        "album": album.album,
        "year": album.year or None,
        "track": ours.index if ours else None,
        "track_total": len(album.tracks) or None,
        "album_type": album.albumtype or None,
        "label": album.label or None,
        "cover_url": f"https://coverartarchive.org/release/{release['id']}/front",
    }


def handle(request_id: str, params: dict) -> dict:
    from beets.library import Item
    from beets import autotag

    ensure_plugins()
    plugin = mb_plugin()

    item = Item()
    item.artist = params.get("artist") or ""
    item.title = params.get("title") or ""
    if params.get("length"):
        item.length = float(params["length"])

    proposal = autotag.tag_item(item)
    candidates = []
    for match in proposal.candidates[:_MAX_CANDIDATES]:
        rec_id = getattr(match.info, "track_id", None)
        if not rec_id:
            continue
        pct = round((1 - float(match.distance)) * 100)
        try:
            cand = _candidate_from_recording(plugin, rec_id, pct)
        except Exception as exc:  # a single bad recording must not sink the whole query
            protocol.log(f"metadata: recording {rec_id} failed: {exc}")
            cand = None
        if cand:
            candidates.append(cand)

    return {"candidates": candidates}
