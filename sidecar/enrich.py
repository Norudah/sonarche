"""Enrich an imported item from its acoustic fingerprint.

fpcalc computes the Chromaprint locally, AcoustID resolves it to an exact
MusicBrainz recording (studio version rather than live/covers), and the
recording's canonical release supplies album, year, track number, genre and
cover. Text search is a conservative fallback."""

import json
import os
import subprocess

import beets_paths
import covers
import metadata
import protocol
import provenance
import provisional
import suspect
from report import build_report

_ACOUSTID_LOOKUP = "https://api.acoustid.org/v2/lookup"
_MIN_SCORE = 0.6
# No fingerprint safety net for text search: near-perfect hits only.
_MAX_TEXT_DISTANCE = 0.10
# Five, not three, so a less-submitted sibling edition stays a candidate.
_MAX_RECORDINGS = 5


# Prevents a console window flashing on Windows for each subprocess.
_NO_WINDOW = (
    {"creationflags": subprocess.CREATE_NO_WINDOW}
    if hasattr(subprocess, "CREATE_NO_WINDOW")
    else {}
)


def _fingerprint(fpcalc: str, path: str) -> tuple[int, str]:
    proc = subprocess.run(
        [fpcalc, "-json", path],
        capture_output=True,
        check=False,
        text=True,
        # fpcalc echoes the (possibly non-ASCII) path; the Windows locale is cp1252.
        encoding="utf-8",
        errors="replace",
        timeout=60,
        **_NO_WINDOW,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"fpcalc failed (exit {proc.returncode}): {proc.stderr.strip()[:200]}")
    data = json.loads(proc.stdout)
    return int(data["duration"]), data["fingerprint"]


def _lookup_recordings(api_key: str, fingerprint: str, duration: int) -> list[str]:
    import requests

    resp = requests.post(
        _ACOUSTID_LOOKUP,
        data={
            "client": api_key,
            "format": "json",
            "fingerprint": fingerprint,
            "duration": duration,
            "meta": "recordings sources",
        },
        timeout=30,
    )
    resp.raise_for_status()
    payload = resp.json()
    if payload.get("status") != "ok":
        message = payload.get("error", {}).get("message", "unknown error")
        raise RuntimeError(f"AcoustID: {message}")

    recordings: list[str] = []
    results = sorted(payload.get("results", []), key=lambda r: r.get("score", 0), reverse=True)
    for result in results:
        if result.get("score", 0) < _MIN_SCORE:
            continue
        # The score rates the fingerprint, not each linked recording; `sources`
        # (submission count) separates the real recording from mislinks.
        by_sources = sorted(
            result.get("recordings") or [],
            key=lambda rec: rec.get("sources", 0),
            reverse=True,
        )
        for rec in by_sources:
            if rec.get("id") and rec["id"] not in recordings:
                recordings.append(rec["id"])
    return recordings[:_MAX_RECORDINGS]


def _album_for_recording(rec_id: str):
    """Resolve a recording to (AlbumInfo, TrackInfo, release) via its canonical release."""
    plugin = metadata.mb_plugin()
    rec = plugin.mb_api.get_recording(rec_id, includes=["releases", "release-groups"])
    release = metadata.pick_release(rec.get("releases", []) if isinstance(rec, dict) else [])
    if not release:
        return None, None, None
    album_info = plugin.album_for_id(release["id"])
    if not album_info:
        return None, None, None
    track_info = next((t for t in album_info.tracks if t.track_id == rec_id), None)
    if not track_info:
        return None, None, None
    return album_info, track_info, release


# Title verdicts, in sort order.
_TITLE_NAMES = 0  # shares a real word with the video title
_TITLE_NEUTRAL = 1  # no evidence either way (junk or empty titles)
_TITLE_CONTRADICTS = 2  # both carry words, none shared


def candidate_sort_key(title_hint: str | None, candidate_title: str | None, release: dict) -> tuple:
    """Sort key for a candidate recording; lower is better.

    The video title outranks the release type, since AcoustID often mislinks
    confusable recordings (language versions, same-soundtrack songs). Release
    rank only breaks ties within a title verdict; junk titles are neutral."""
    if suspect.titles_agree(title_hint, candidate_title):
        verdict = _TITLE_NAMES
    elif suspect.is_title_mismatch(title_hint, candidate_title):
        verdict = _TITLE_CONTRADICTS
    else:
        verdict = _TITLE_NEUTRAL
    return (verdict, metadata.release_rank(release))


def is_settled(key: tuple, title_hint: str | None) -> bool:
    """Whether a candidate can't be beaten: a clean studio album the title
    vouches for, or on rank alone when the hint has no usable words."""
    verdict, rank = key
    confirmed = verdict == _TITLE_NAMES or not suspect.has_words(title_hint)
    return confirmed and not rank[0] and rank[1] == 0


def _text_fallback(item, artist_hint: str | None, title_hint: str | None) -> str | None:
    """Search MusicBrainz by the download's hints. Nothing is stored here."""
    from beets import autotag

    if not (artist_hint or title_hint):
        return None
    item.artist = artist_hint or item.artist
    item.title = title_hint or item.title
    proposal = autotag.tag_item(item)
    for match in proposal.candidates[:1]:
        if float(match.distance) <= _MAX_TEXT_DISTANCE:
            return getattr(match.info, "track_id", None)
    return None


# Fields describing the audio file rather than the work; beets reads them
# from the file at import and they must survive tagging.
_FILE_FIELDS = ("length",)


def work_fields(merged) -> dict:
    """A matched TrackInfo without file-level fields.

    MusicBrainz' `length` is the recording's duration, which never exactly
    matches the downloaded file; the item's own length stays authoritative."""
    return {key: value for key, value in dict(merged).items() if key not in _FILE_FIELDS}


def find_album_row(lib, release_id: str | None):
    """The library's album row for a MusicBrainz release id, or None."""
    from beets.dbcore.query import MatchQuery

    if not release_id:
        return None
    for album in lib.albums(MatchQuery("mb_albumid", release_id)):
        return album
    return None


def find_named_row(lib, albumartist: str | None, album_title: str | None):
    """The album row with exactly this albumartist + album, or None.

    Fallback for `find_album_row`: the UI groups albums by name, so two rows for
    one name only split the folder (%aunique). Collections and blank names are
    never returned; with several matches the fullest row wins."""
    from beets.dbcore.query import AndQuery, MatchQuery

    import library

    if not albumartist or not album_title:
        return None
    rows = [
        row
        for row in lib.albums(
            AndQuery([MatchQuery("albumartist", albumartist), MatchQuery("album", album_title)])
        )
        if row.get(library.ALBUM_KIND_KEY) != library.COLLECTION
    ]
    if not rows:
        return None
    if len(rows) == 1:  # the healthy case pays no per-row item count
        return rows[0]
    return max(rows, key=lambda row: (len(list(row.items())), -row.id))


def drop_emptied_row(lib, row) -> None:
    """Remove an album row its last item just left, with its cover and folder.

    `remove(delete=True, with_items=False)` deletes the cover file so the
    following sweep can prune the directory."""
    from beets import util

    art_dir = os.path.dirname(beets_paths.decode(row.artpath)) if row.artpath else None
    row.remove(delete=True, with_items=False)
    if art_dir and os.path.isdir(art_dir):
        covers.remove_legacy_archives(art_dir)
        try:
            util.prune_dirs(art_dir, lib.directory)
        except OSError as exc:
            protocol.log(f"enrich: husk prune failed: {exc}")


def _album_row_for(lib, item):
    """The album row `item` belongs on after its tags were (re)written.

    When a match changes the release, the item joins that release's row rather
    than renaming its current folder under its siblings; the old row is dropped
    once empty."""
    album = item.get_album()
    release_id = item.mb_albumid or ""
    if not release_id or (album is not None and (album.mb_albumid or "") == release_id):
        # Singletons need a row, or the cover fetch bails and the file lands in Non-Album/.
        return album if album is not None else lib.add_album([item])

    # Exact release first, then another edition's row with the same name.
    target = find_album_row(lib, release_id)
    if target is None:
        target = find_named_row(lib, item.albumartist, item.album)
        if target is not None and target.id == (item.album_id or None):
            return target
    if target is not None:
        item.album_id = target.id
        item.store()
    else:
        target = lib.add_album([item])
    if album is not None and not list(album.items()):
        drop_emptied_row(lib, album)
    return target


def store_and_file(lib, item, sync_album: bool = True) -> None:
    """Store the item, write its tags, attach it to an album row and move it.

    `sync_album=False` leaves an already-trusted album row untouched (e.g. a
    provisional track joining its matched siblings)."""
    from beets import library

    item.store()
    try:
        item.write()
    except Exception as exc:  # DB is authoritative; file tags are best-effort
        protocol.log(f"enrich: tag write failed: {exc}")

    # Sync the album row before moving: destination() reads $album/$albumartist
    # from the row, and beets' duplicate check treats blank rows as duplicates.
    album = _album_row_for(lib, item)
    # Another release's row reused by name keeps its own tags.
    foreign = bool(album.mb_albumid) and str(album.mb_albumid) != str(item.mb_albumid or "")
    if sync_album and not foreign:
        for key in library.Album.item_keys:
            album[key] = item[key]
        album.store()

    try:
        item.move()
    except Exception as exc:
        protocol.log(f"enrich: move failed: {exc}")


def _file_as_singleton(lib, item) -> None:
    """File an unclaimed guess as a singleton, which the provisional flag routes
    to `Unidentified/`. A blank row the item leaves behind is dropped once empty.

    A blank album row would give the folder no name, and %aunique would fall
    back to row ids (`<channel>/[86]/`)."""
    old_row = item.get_album()
    if item.album_id is not None:
        item.album_id = None
    item.store()
    try:
        item.write()
    except Exception as exc:  # DB is authoritative; file tags are best-effort
        protocol.log(f"enrich: tag write failed: {exc}")
    if old_row is not None and not list(old_row.items()):
        drop_emptied_row(lib, old_row)
    try:
        item.move()
    except Exception as exc:
        protocol.log(f"enrich: move failed: {exc}")


def apply_provisional(lib, item, params: dict, album=None, file: bool = True) -> bool:
    """Fill an unidentified file from the download hints (and `album`, if its
    siblings matched) and flag it as a guess. Returns whether anything was written.

    `file=False` writes tags without moving: the forced-album flow re-files
    everything right after."""
    fields = provisional.guess_fields(
        title=params.get("title"),
        artist=params.get("artist"),
        album_fields=provisional.album_fields(album) if album is not None else None,
    )
    if not provisional.apply(item, fields):
        protocol.log(f"enrich: item {item.id} unidentified and no hint to guess from")
        return False
    protocol.log(f"enrich: item {item.id} provisionally tagged from {sorted(fields)}")
    if not file:
        item.store()
        try:
            item.write()
        except Exception as exc:  # DB is authoritative; file tags are best-effort
            protocol.log(f"enrich: tag write failed: {exc}")
        return True
    if album is not None:
        item.album_id = album.id
        # beets picks the path template from each item's `comp`; it must match the album.
        item.comp = album.comp
        store_and_file(lib, item, sync_album=False)
        return True

    current = item.get_album()
    if current is not None and (str(current.album) or "").strip():
        # Already on a named record (failed re-run): stay, without rewriting the row.
        store_and_file(lib, item, sync_album=False)
    else:
        _file_as_singleton(lib, item)
    return True


def _apply(lib, item, album_info, track_info) -> None:
    merged = track_info.merge_with_album(album_info)
    item.update(work_fields(merged))

    # MB genres canonicalize offline; otherwise _get_genre falls back to Last.fm.
    # An empty result keeps the raw MB genre. Hand-edited genres are overwritten
    # on purpose: the re-match confirmation dialog warns about it.
    genres, label = metadata.lastgenre_plugin()._get_genre(item)
    if genres:
        item.genres = genres
        protocol.log(f"enrich: genre {genres} ({label})")

    store_and_file(lib, item)


def _fetch_cover(item, release_id: str, release_group_id: str | None = None) -> None:
    album = item.get_album()
    if album is None:
        return
    cover = covers.download_cover(release_id, release_group_id)
    if cover is None:
        return
    covers.set_album_art(album, *cover)
    covers.embed_cover(item, *cover)


def handle(request_id: str, params: dict) -> dict:
    from beets.library import Library

    import library

    lib = Library(params["beets_db"], directory=params["library_dir"])
    item = lib.get_item(params["item_id"])
    if item is None:
        raise RuntimeError(f"item not found: {params['item_id']}")

    # A collection is not a release: matching would move the track onto the
    # release's album row, out of the user's collection.
    if item.album_id:
        album = lib.get_album(item.album_id)
        if album is not None and album.get(library.ALBUM_KIND_KEY) == library.COLLECTION:
            raise RuntimeError("track sits on a collection: re-identify would re-file it")

    metadata.ensure_plugins()
    return enrich_one(request_id, lib, item, params)


def enrich_one(
    request_id: str,
    lib,
    item,
    params: dict,
    fetch_cover: bool = True,
    provisional_fallback: bool = True,
    known_recordings: list[str] | None = None,
) -> dict:
    """Fingerprint-first enrichment of one item.

    The caller owns the Library and must have called `metadata.ensure_plugins()`.
    `params` carries fpcalc, acoustid_key and optional title/artist hints.
    `fetch_cover=False` and `provisional_fallback=False` defer those steps to
    the album batch. `known_recordings` reuses the batch's AcoustID results;
    `[]` means "looked up, nothing found", `None` means "not looked up"."""
    path = beets_paths.item_path(item)
    if not os.path.exists(path):
        raise RuntimeError(f"file not found: {path}")

    if known_recordings is not None:
        recordings, fingerprinted = known_recordings, True
    else:
        recordings, fingerprinted = _lookup_item(request_id, item, path, params)

    album_info, track_info = _best_candidate(recordings, params.get("title"))
    source = "acoustid" if track_info is not None else None
    if track_info is None:
        rec_id = _text_fallback(item, params.get("artist"), params.get("title"))
        if rec_id:
            try:
                album_info, track_info, _ = _album_for_recording(rec_id)
                source = "text" if track_info is not None else None
            except Exception as exc:
                protocol.log(f"enrich: fallback recording {rec_id} failed: {exc}")

    matched = bool(album_info and track_info)
    if matched:
        protocol.send_event(request_id, "enrich_progress", {"stage": "apply", "item_id": item.id})
        # Read before _apply rewrites it.
        previous_release = str(item.mb_albumid or "")
        _apply(lib, item, album_info, track_info)
        if fetch_cover:
            _refresh_cover(item, album_info, previous_release)
    elif provisional_fallback:
        apply_provisional(lib, item, params)

    # _text_fallback may have mutated the in-memory item without storing.
    fresh = lib.get_item(item.id)
    if fresh is not None and (fingerprinted or matched):
        _record_outcome(fresh, fingerprinted, source if matched else None, params.get("title"))
    return {"matched": matched, "report": build_report(fresh) if fresh else None}


def _lookup_item(request_id: str, item, path: str, params: dict) -> tuple[list[str], bool]:
    """AcoustID recordings for the file, and whether it was fingerprinted."""
    api_key = params.get("acoustid_key")
    if not api_key:
        protocol.log("enrich: no AcoustID key configured, text fallback only")
        return [], False
    protocol.send_event(request_id, "enrich_progress", {"stage": "fingerprint", "item_id": item.id})
    duration, fingerprint = _fingerprint(params["fpcalc"], path)
    protocol.send_event(request_id, "enrich_progress", {"stage": "lookup", "item_id": item.id})
    recordings = _lookup_recordings(api_key, fingerprint, duration)
    protocol.log(f"enrich: acoustid returned {len(recordings)} recording(s)")
    return recordings, True


def _best_candidate(recordings: list[str], title_hint: str | None):
    """(album_info, track_info) of the best-ranked recording, or (None, None).

    A fingerprint links to several recordings (album version, best-ofs...), so
    every candidate's canonical release is scored; see `candidate_sort_key`."""
    album_info = track_info = None
    best_key = None
    for rec_id in recordings:
        try:
            ai, ti, release = _album_for_recording(rec_id)
        except Exception as exc:  # one bad recording must not sink the others
            protocol.log(f"enrich: recording {rec_id} failed: {exc}")
            continue
        if ti is None:
            continue
        key = candidate_sort_key(title_hint, ti.title, release)
        if best_key is None or key < best_key:
            album_info, track_info, best_key = ai, ti, key
        if is_settled(key, title_hint):
            break
    if track_info is not None and best_key is not None and best_key[0] == _TITLE_CONTRADICTS:
        protocol.log(
            f"enrich: no candidate matched the video title « {title_hint} », "
            f"keeping best-ranked « {track_info.title} »"
        )
    return album_info, track_info


def _refresh_cover(item, album_info, previous_release: str) -> None:
    album = item.get_album()
    # Same release: keep the existing (possibly user-chosen) cover.
    same_release = bool(previous_release) and previous_release == str(album_info.album_id or "")
    # Another edition's named row keeps its own cover too.
    foreign_row = (
        album is not None
        and bool(album.mb_albumid)
        and str(album.mb_albumid) != str(album_info.album_id or "")
    )
    if (same_release or foreign_row) and album is not None and album.artpath:
        protocol.log("enrich: cover already on the record, keeping it")
        return
    try:
        _fetch_cover(item, album_info.album_id, album_info.releasegroup_id)
    except Exception as exc:  # metadata landed; a missing cover is not a failure
        protocol.log(f"enrich: cover fetch failed: {exc}")


def _record_outcome(item, fingerprinted: bool, match_source: str | None, title_hint) -> None:
    """Provenance flags on the stored item. `match_source` is None without a match."""
    if fingerprinted:
        provenance.mark_fingerprinted(item)
    if match_source:
        # A real match lifts the provisional flag.
        if provisional.clear(item):
            protocol.log(f"enrich: item {item.id} no longer provisional")
        provenance.mark_match(item, match_source)
        if suspect.mark(item, title_hint):
            protocol.log(
                f"enrich: item {item.id} flagged {suspect.TITLE_MISMATCH}: "
                f"« {title_hint} » matched « {item.title} »"
            )
    item.store()
