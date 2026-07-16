"""Recompute genres for the whole library against the current tree/whitelist.

Much cheaper than a re-enrich: no fingerprinting, no MusicBrainz. Items whose
genres came from MB canonicalize offline; only items with no genre at all
trigger a Last.fm fetch. Meant to run after the genre tree or the lastgenre
config changes."""

import metadata
import protocol


def recompute(request_id: str, params: dict) -> dict:
    from beets.library import Library

    metadata.ensure_plugins()
    plugin = metadata.lastgenre_plugin()

    lib = Library(params["beets_db"], directory=params["library_dir"])
    items = list(lib.items())
    total = len(items)
    updated = 0
    for done, item in enumerate(items, start=1):
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
        if done % 10 == 0 or done == total:
            protocol.send_event(
                request_id, "genres_progress", {"done": done, "total": total}
            )
    return {"total": total, "updated": updated}
