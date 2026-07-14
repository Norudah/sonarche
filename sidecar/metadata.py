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
_TYPE_RANK = {"album": 0, "ep": 1, "single": 2, "compilation": 3}


def _ensure_plugins():
    global _loaded
    if _loaded:
        return
    from beets import config, plugins

    config["plugins"] = ["musicbrainz"]
    plugins.load_plugins()
    _loaded = True


def _mb_plugin():
    import beets.metadata_plugins as mp

    sources = mp.find_metadata_source_plugins()
    if not sources:
        raise RuntimeError("no metadata source plugin loaded")
    return sources[0]


def _pick_release(releases: list) -> dict | None:
    """Prefer an official, dated release; earliest wins (original over reissue)."""
    if not releases:
        return None
    official = [r for r in releases if r.get("status") == "Official"] or releases
    return sorted(official, key=lambda r: (r.get("date") or "9999"))[0]


def _candidate_from_recording(plugin, rec_id: str, match_pct: int) -> dict | None:
    rec = plugin.mb_api.get_recording(rec_id, includes=["releases"])
    release = _pick_release(rec.get("releases", []) if isinstance(rec, dict) else [])
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

    _ensure_plugins()
    plugin = _mb_plugin()

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
