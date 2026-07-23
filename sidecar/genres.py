"""Recompute genres for the whole library against the current tree/whitelist.

Much cheaper than a re-enrich: no fingerprinting, no MusicBrainz. Items whose
genres came from MB canonicalize offline; only items with no genre at all
trigger a Last.fm fetch. Meant to run after the genre tree or the lastgenre
config changes."""

import time

import metadata
import protocol
import provenance

# lastgenre's Last.fm client (beetsplug/lastgenre/client.py) has no rate
# limiting of its own, and it shares beets' embedded API key with every other
# beets install — hammering it across a whole library risks 429s or a
# temporary block for everyone using that key, not just us. Pace the batch:
# only items with no existing genre reach the network (up to 3 sequential
# calls: track, album, artist), so the pause only applies to those. The Rust
# host passes the user's configured delay (Settings > Limitations appels
# API); this is only a fallback for direct/test invocations.
_DEFAULT_FETCH_PAUSE_SECONDS = 1.0


def recompute(request_id: str, params: dict) -> dict:
    from beets.library import Library

    metadata.ensure_plugins()
    plugin = metadata.lastgenre_plugin()
    pause = max(0.0, float(params.get("fetch_pause_seconds", _DEFAULT_FETCH_PAUSE_SECONDS)))

    lib = Library(params["beets_db"], directory=params["library_dir"])
    items = list(lib.items())
    total = len(items)
    updated = 0
    for done, item in enumerate(items, start=1):
        # A human's genre choice must survive a bulk recompute: the manual
        # trail (provenance) outranks the tree.
        if provenance.was_hand_edited(item, "genres"):
            protocol.log(f"genres: {item.artist} - {item.title} hand-edited, spared")
        else:
            had_genre = bool(item.get("genres", with_album=False))
            genres, label = plugin._get_genre(item)
            # Empty result = nothing resolved and no fallback configured: keep the
            # existing genre rather than erasing it (same policy as enrich).
            if genres and list(genres) != list(item.get("genres", with_album=False) or []):
                item.genres = genres
                item.store()
                try:
                    item.write()
                except Exception as exc:  # DB is authoritative; file tags are best-effort
                    protocol.log(f"genres: tag write failed: {exc}")
                updated += 1
                protocol.log(f"genres: {item.artist} - {item.title} -> {genres} ({label})")
            if not had_genre and pause > 0:
                time.sleep(pause)
        if done % 10 == 0 or done == total:
            protocol.send_event(
                request_id, "genres_progress", {"done": done, "total": total}
            )
    return {"total": total, "updated": updated}
