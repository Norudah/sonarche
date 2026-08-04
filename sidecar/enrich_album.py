"""Enrich a whole album's items against one MusicBrainz release.

Every file is fingerprinted (fpcalc is local and free; only the AcoustID
lookup hits the network, paced under its 3 req/s), giving each item its
recording identity. From there: two files of one recording are duplicates
(playlists love mislabelled re-uploads) and only the first is kept; a release
is voted from sampled recordings; the item→track mapping is exact by
recording id, with duration rescuing the files AcoustID couldn't identify —
YouTube titles are never trusted; and bonus tracks living on sibling editions
of the same release-group (deluxe, regional) are adopted into the main
album's folder. Per-track enrichment remains the fallback when no coherent
release emerges."""

import os
import time

import covers
import enrich
import forced_album
import metadata
import protocol
import provenance
import suspect
from report import build_report

# Sampled tracks are enough to identify the release; each sample costs a few
# MusicBrainz calls (~1 req/s), so not every item votes.
_MAX_SAMPLES = 3
# A mapped file may differ from its studio track by trims/silence, but a wrong
# mapping is usually a different song entirely — durations are the one signal
# YouTube can't corrupt (channel names and video titles are junk hints).
_MAX_DURATION_DIFF_SECONDS = 20.0
# The text search has no fingerprint safety net: near-perfect hits only.
_MAX_TEXT_ALBUM_DISTANCE = 0.15

_DEFAULT_FETCH_PAUSE_SECONDS = 1.0
# AcoustID allows 3 req/s per application key; fpcalc adds natural headroom.
_DEFAULT_LOOKUP_PAUSE_SECONDS = 0.5


def vote_release(release_sets: list[list[dict]], track_count: int) -> str | None:
    """Pick the release id best supported by the sampled fingerprints. Pure.

    `release_sets` holds one list of MB release dicts per sampled track.
    Releases backed by more samples win; ties break on exact track count
    (when the lookup carried one), then on release_rank (studio album over
    compilation, earliest date).
    """
    votes: dict[str, int] = {}
    by_id: dict[str, dict] = {}
    for releases in release_sets:
        seen = set()
        for release in releases:
            release_id = release.get("id")
            if not release_id or release_id in seen:
                continue
            seen.add(release_id)
            votes[release_id] = votes.get(release_id, 0) + 1
            by_id.setdefault(release_id, release)
    if not votes:
        return None

    def _track_count(release: dict) -> int | None:
        # Key name depends on the MB client's normalization; tolerate both.
        for key in ("track-count", "track_count", "medium-track-count"):
            value = release.get(key)
            if isinstance(value, int):
                return value
        return None

    def _key(release_id: str):
        release = by_id[release_id]
        return (
            -votes[release_id],
            0 if _track_count(release) == track_count else 1,
            metadata.release_rank(release),
        )

    return sorted(votes, key=_key)[0]


def rescue_candidates(release_sets: list[list[dict]], exclude: str | None = None) -> list[str]:
    """Alternative release ids worth re-testing when the voted release leaves
    identified files off it, ranked by how many leftovers each could host
    (release_rank breaks ties). Pure.

    `release_sets` holds one list of MB release dicts per leftover — the
    releases its own recordings live on. The voted release (`exclude`) is
    never a candidate: it already had its chance."""
    votes: dict[str, int] = {}
    by_id: dict[str, dict] = {}
    for releases in release_sets:
        seen = set()
        for release in releases:
            release_id = release.get("id")
            if not release_id or release_id == exclude or release_id in seen:
                continue
            seen.add(release_id)
            votes[release_id] = votes.get(release_id, 0) + 1
            by_id.setdefault(release_id, release)
    return sorted(votes, key=lambda rid: (-votes[rid], metadata.release_rank(by_id[rid])))


def slot_rescues(leftovers, tracks, hints: dict) -> dict:
    """Seat leftover items onto the voted release's still-empty tracks when the
    video's own title agrees with the track title AND the duration fits. Pure —
    needs `.id`/`.length` on items, `.title`/`.length` on tracks. Returns
    {item: track}, each track seated at most once (nearest duration wins).

    Leftovers were identified as some *other* release's recording — the
    cross-language trap again: the fingerprint resolves to the popular sibling
    edition ("Here I Am"), whose recording is absent from the release in hand,
    and the file used to fall through to per-track fallback and found a
    one-track album next door. Neither signal alone is trusted (titles are junk
    on most videos; duration alone is reserved for AcoustID-silent files), but
    a title the uploader typed that names an open slot, at that slot's length,
    outweighs a fingerprint known to cross-link editions. Both lengths must be
    present: title agreement alone seats nothing."""
    assignments: dict = {}
    taken: set[int] = set()
    for item in leftovers:
        hint = (hints.get(item.id) or {}).get("title")
        file_length = float(item.length) if item.length else None
        if not hint or not file_length:
            continue
        best = None
        for track in tracks:
            if id(track) in taken or not track.length:
                continue
            if not suspect.titles_agree(hint, track.title):
                continue
            diff = abs(file_length - float(track.length))
            if diff <= _MAX_DURATION_DIFF_SECONDS and (best is None or diff < best[0]):
                best = (diff, track)
        if best is not None:
            assignments[item] = best[1]
            taken.add(id(best[1]))
    return assignments


def _pair_plausible(file_length: float | None, track_length: float | None) -> bool:
    """A pair with a missing side doesn't count against the mapping."""
    if not file_length or not track_length:
        return True
    return abs(file_length - track_length) <= _MAX_DURATION_DIFF_SECONDS


def find_content_duplicates(recording_lists: list[tuple[int, list[str]]]) -> dict[int, int]:
    """{duplicate item id: kept item id} for items sharing the same *primary*
    AcoustID recording — the top, highest-confidence match, which is the audio's
    real identity. Pure. First occurrence wins; items with no recordings never
    match.

    Only the primary counts, never the full candidate set: a fingerprint often
    links to secondary recordings (lower-confidence, frequently mislinked user
    submissions), and two genuinely different album tracks can share one of
    those. Intersecting on secondaries flagged distinct tracks as duplicates and
    deleted real files — a real duplicate always shares the *primary*, so the
    secondaries add false positives without catching anything new."""
    kept: dict[str, int] = {}  # primary recording id -> first item that had it
    duplicates: dict[int, int] = {}
    for item_id, recordings in recording_lists:
        primary = recordings[0] if recordings else None
        if primary is None:
            continue
        if primary in kept:
            duplicates[item_id] = kept[primary]
        else:
            kept[primary] = item_id
    return duplicates


def match_by_recordings(items, tracks, recordings_by_item: dict) -> tuple[dict, list, list]:
    """(mapping item→track, leftover_items, extra_tracks). Pure — needs only
    `.id`/`.length` on items and `.track_id`/`.length` on tracks.

    First pass is content identity: an item maps to the release track whose id
    is among its AcoustID recordings. Second pass rescues the items AcoustID
    couldn't identify by nearest duration among the remaining slots. Items
    identified as some OTHER recording never fall back to duration — they are
    genuinely off this release. Third pass pairs a lone survivor with a lone
    empty slot, which no evidence but elimination can place."""
    mapping: dict = {}
    remaining = list(tracks)
    silent, leftovers = [], []
    for item in items:
        recordings = set(recordings_by_item.get(item.id) or ())
        if not recordings:
            silent.append(item)
            continue
        track = next((t for t in remaining if t.track_id in recordings), None)
        if track is not None:
            mapping[item] = track
            remaining.remove(track)
        else:
            leftovers.append(item)
    for item in silent:
        file_length = float(item.length) if item.length else None
        best = None
        for track in remaining:
            if not file_length or not track.length:
                continue
            diff = abs(file_length - track.length)
            if diff <= _MAX_DURATION_DIFF_SECONDS and (best is None or diff < best[0]):
                best = (diff, track)
        if best is not None:
            mapping[item] = best[1]
            remaining.remove(best[1])
        else:
            leftovers.append(item)

    # One file left, one slot left, and the release already carried by a
    # majority of the batch: elimination places it even though the earlier
    # passes could not. A music-video rip resolves to the single's recording
    # rather than the album's, and can run a half-minute past the album master
    # — so neither content identity nor duration reaches it. The majority guard
    # is what keeps a genuine bonus track (which arrives with no mapping behind
    # it) from being forced into an unrelated free slot.
    if len(leftovers) == 1 and len(remaining) == 1 and len(mapping) > len(items) / 2:
        mapping[leftovers[0]] = remaining[0]
        leftovers, remaining = [], []

    return mapping, leftovers, remaining


def _apply_hints(items, hints: dict, artist: str | None) -> None:
    """In-memory only, never stored: the text fallback's mapping distance on
    empty tags degrades badly without title/track hints."""
    for item in items:
        hint = hints.get(item.id) or {}
        if hint.get("title"):
            item.title = hint["title"]
        if artist:
            item.artist = artist
        if hint.get("index"):
            item.track = int(hint["index"])


def _fingerprint_all(request_id: str, items, params: dict) -> dict[int, list[str]]:
    """fpcalc + AcoustID lookup for every item: {item_id: [recording ids]}.
    One bad file yields [] rather than sinking the batch."""
    recordings: dict[int, list[str]] = {}
    total = len(items)
    lookup_pause = max(
        0.0, float(params.get("lookup_pause_seconds", _DEFAULT_LOOKUP_PAUSE_SECONDS))
    )
    protocol.log(f"enrich_album: fingerprinting {total} file(s)")
    for done, item in enumerate(items):
        path = enrich._decode_path(item)
        if not os.path.exists(path):
            recordings[item.id] = []
            continue
        protocol.log(
            f"enrich_album: fingerprint {done + 1}/{total}: {os.path.basename(path)}"
        )
        protocol.send_event(
            request_id,
            "enrich_progress",
            {"stage": "fingerprint", "done": done, "total": total, "item_id": item.id},
        )
        try:
            duration, fingerprint = enrich._fingerprint(params["fpcalc"], path)
            # Stored here, while the item is still exactly its DB row — after
            # this point `_apply_hints` mutates items in memory and a store
            # would persist the hints. Fingerprinted is a fact even when the
            # lookup below then fails or matches nothing.
            provenance.mark_fingerprinted(item)
            item.store()
            protocol.send_event(
                request_id,
                "enrich_progress",
                {"stage": "lookup", "done": done, "total": total, "item_id": item.id},
            )
            recordings[item.id] = enrich._lookup_recordings(
                params["acoustid_key"], fingerprint, duration
            )
            protocol.log(
                f"enrich_album: fingerprint ok ({len(recordings[item.id])} recording(s))"
            )
        except Exception as exc:
            protocol.log(f"enrich_album: item {item.id} fingerprint failed: {exc}")
            recordings[item.id] = []
        if lookup_pause > 0 and done < total - 1:
            time.sleep(lookup_pause)
    return recordings


def _remove_duplicates(request_id: str, lib, items, recordings: dict) -> tuple[list, dict[int, int]]:
    """Delete items (file included) that duplicate an earlier item's recording.
    Runs before matching so duplicates never fight over one track slot or one
    destination path. Returns (kept items, {removed id: kept id})."""
    duplicates = find_content_duplicates(
        [(item.id, list(recordings.get(item.id) or ())) for item in items]
    )
    kept = [item for item in items if item.id not in duplicates]
    for item in items:
        if item.id not in duplicates:
            continue
        protocol.log(
            f"enrich_album: item {item.id} duplicates item {duplicates[item.id]}, removing"
        )
        try:
            item.remove(delete=True)
        except Exception as exc:
            protocol.log(f"enrich_album: duplicate removal failed: {exc}")
        protocol.send_event(
            request_id, "enrich_progress", {"stage": "track_done", "item_id": item.id}
        )
    return kept, duplicates


def _remove_library_duplicates(request_id: str, lib, items, recordings: dict) -> tuple[list, dict[int, int]]:
    """Delete new items whose primary recording the library already holds — the
    single downloaded yesterday coming back inside today's playlist. Same
    policy as the in-batch pass (first copy wins, file deleted), keyed on
    `mb_trackid`, which is exactly the recording a kept item was matched to.
    Returns (kept items, {removed id: existing library item id})."""
    from beets.dbcore.query import MatchQuery

    batch_ids = {item.id for item in items}
    kept, duplicates = [], {}
    for item in items:
        primary = next(iter(recordings.get(item.id) or ()), None)
        existing = None
        if primary:
            existing = next(
                (
                    candidate
                    for candidate in lib.items(MatchQuery("mb_trackid", primary))
                    if candidate.id not in batch_ids
                ),
                None,
            )
        if existing is None:
            kept.append(item)
            continue
        protocol.log(
            f"enrich_album: item {item.id} duplicates library item {existing.id}, removing"
        )
        try:
            item.remove(delete=True)
        except Exception as exc:
            protocol.log(f"enrich_album: duplicate removal failed: {exc}")
        duplicates[item.id] = existing.id
        protocol.send_event(
            request_id, "enrich_progress", {"stage": "track_done", "item_id": item.id}
        )
    return kept, duplicates


def _vote_release_id(request_id: str, items, recordings: dict, pause: float) -> str | None:
    """Vote among the releases of a few sampled items' recordings. Samples
    spread across the batch, skipping items AcoustID didn't identify."""
    plugin = metadata.mb_plugin()
    known = [item for item in items if recordings.get(item.id)]
    if not known:
        return None
    n = len(known)
    positions = sorted({0, n // 2, n - 1})[:_MAX_SAMPLES]
    release_sets: list[list[dict]] = []
    total = len(positions)
    for done, pos in enumerate(positions):
        item = known[pos]
        releases: list[dict] = []
        for rec_id in recordings[item.id]:
            try:
                # MusicBrainz pacing is handled by beets' client (~1 req/s).
                rec = plugin.mb_api.get_recording(rec_id, includes=["releases", "release-groups"])
                releases.extend(rec.get("releases", []) if isinstance(rec, dict) else [])
            except Exception as exc:
                protocol.log(f"enrich_album: recording {rec_id} failed: {exc}")
        if releases:
            release_sets.append(releases)
        if pause > 0 and done < total - 1:
            time.sleep(pause)
    return vote_release(release_sets, len(items))


def _build_match(items, recordings: dict, release_id: str):
    """(AlbumMatch, leftovers) on the voted release with a recording-exact
    mapping, or (None, items) unless a majority of the files map onto it."""
    from beets.autotag.distance import Distance
    from beets.autotag.match import AlbumMatch

    album_info = metadata.mb_plugin().album_for_id(release_id)
    if album_info is None:
        return None, list(items)
    mapping, leftovers, extra_tracks = match_by_recordings(items, album_info.tracks, recordings)
    if len(mapping) <= len(items) / 2:
        protocol.log(
            f"enrich_album: voted release rejected (only {len(mapping)} of "
            f"{len(items)} tracks map onto it)"
        )
        return None, list(items)
    protocol.log(
        f"enrich_album: mapped {len(mapping)}/{len(items)} track(s) onto "
        f"« {album_info.album} » by recording id"
    )
    if leftovers:
        protocol.log(
            f"enrich_album: {len(leftovers)} track(s) off the voted release"
        )
    match = AlbumMatch(
        distance=Distance(),
        info=album_info,
        mapping=mapping,
        extra_items=list(leftovers),
        extra_tracks=extra_tracks,
    )
    return match, leftovers


# Coverage rescue budget: releases actually re-tested (one album_for_id each)
# and recordings resolved per leftover (one get_recording each, ~1 req/s).
_MAX_RESCUE_RELEASES = 2
_MAX_RESCUE_RECORDINGS = 3


def _rescue_coverage(request_id: str, items, recordings: dict, match, leftovers):
    """Re-test the leftovers' own releases against the whole batch and switch
    to one that maps strictly more files than the voted release.

    The vote ranks by AcoustID popularity, and popularity is systematically
    wrong when two editions share their fingerprints — the French Spirit
    soundtrack's files all resolve to the English edition's recordings too,
    with more sources. The tell is coverage: files AcoustID *identified* that
    still don't map onto the voted release, while some sibling release explains
    them AND the rest of the batch."""
    plugin = metadata.mb_plugin()
    release_sets: list[list[dict]] = []
    for item in leftovers:
        releases: list[dict] = []
        for rec_id in (recordings.get(item.id) or [])[:_MAX_RESCUE_RECORDINGS]:
            try:
                # MusicBrainz pacing is handled by beets' client (~1 req/s).
                rec = plugin.mb_api.get_recording(rec_id, includes=["releases", "release-groups"])
                releases.extend(rec.get("releases", []) if isinstance(rec, dict) else [])
            except Exception as exc:
                protocol.log(f"enrich_album: recording {rec_id} failed: {exc}")
        if releases:
            release_sets.append(releases)

    for release_id in rescue_candidates(release_sets, exclude=match.info.album_id)[:_MAX_RESCUE_RELEASES]:
        candidate, candidate_leftovers = _build_match(items, recordings, release_id)
        if candidate is None:
            continue
        if len(candidate.mapping) > len(match.mapping):
            protocol.log(
                f"enrich_album: « {candidate.info.album} » covers "
                f"{len(candidate.mapping)}/{len(items)} file(s) against "
                f"{len(match.mapping)} on the voted release — switching"
            )
            return candidate, candidate_leftovers
    return match, leftovers


def _rescue_slots(match, leftovers, hints: dict) -> list:
    """Apply `slot_rescues` to the match in place (mapping gains the pair, the
    slot and the item leave the extras). Returns the leftovers still unseated."""
    rescued = slot_rescues(leftovers, match.extra_tracks, hints)
    for item, track in rescued.items():
        protocol.log(
            f"enrich_album: item {item.id} seated on open slot {track.index} "
            f"« {track.title} » by title+duration"
        )
        match.mapping[item] = track
        match.extra_tracks.remove(track)
        if item in match.extra_items:
            match.extra_items.remove(item)
    return [item for item in leftovers if item not in rescued]


def _text_album_match(request_id: str, items, params: dict):
    """All-or-nothing text search: without a fingerprint anchor, only a
    complete, near-perfect release match is trusted."""
    from beets import autotag

    album_title = params.get("album_title")
    artist = params.get("artist")
    if not (album_title or artist):
        return None
    protocol.send_event(request_id, "enrich_progress", {"stage": "match"})
    _, _, proposal = autotag.tag_album(items, search_artist=artist, search_name=album_title)
    for match in proposal.candidates[:1]:
        if (
            not match.extra_items
            and len(match.info.tracks) == len(items)
            and float(match.distance) <= _MAX_TEXT_ALBUM_DISTANCE
        ):
            return match
    return None


def _apply_album(request_id: str, lib, match, pause: float, source: str | None, hints: dict):
    """Apply the match to its mapped items and build the album row. Returns
    (album, mapped_items); covers and reports are the caller's (adopted bonus
    tracks join the album afterwards and must share the same cover pass).
    `source` is how the release was found ("acoustid" vote or "text"), recorded
    on every mapped item; `hints` ({item_id: {"title": …}}) feeds the
    suspect-match check."""
    protocol.send_event(request_id, "enrich_progress", {"stage": "apply"})
    match.apply_metadata()
    mapped = match.items

    # One real album row for the set (items were imported as singletons), built
    # from the now-populated item fields — the single-track path syncs a blank
    # row for the same reason: destination paths and duplicate detection read
    # album-level fields from the row, not the items. A row this library
    # already holds for the release is reused: a second job landing on the
    # same album (the single downloaded before its playlist) must extend it,
    # not stand up a sibling row and a "%aunique"-suffixed folder.
    album = enrich.find_album_row(lib, match.info.album_id)
    if album is not None:
        protocol.log(f"enrich_album: joining existing album row {album.id}")
        for item in mapped:
            item.album_id = album.id
    else:
        album = lib.add_album(mapped)
    match.apply_album_metadata(album)
    album.store()

    lastgenre = metadata.lastgenre_plugin()
    total = len(mapped)
    for done, item in enumerate(mapped, start=1):
        protocol.send_event(
            request_id, "enrich_progress", {"stage": "apply", "item_id": item.id}
        )
        # Same policy as enrich/genres: MB genres canonicalize offline; only a
        # genre-less item reaches Last.fm, and only those pace the loop.
        had_genre = bool(item.get("genres", with_album=False))
        genres, label = lastgenre._get_genre(item)
        if genres:
            item.genres = genres
            protocol.log(f"enrich_album: genre {genres} ({label})")
        if source:
            provenance.mark_match(item, source)
        if suspect.mark(item, (hints.get(item.id) or {}).get("title")):
            protocol.log(
                f"enrich_album: item {item.id} flagged {suspect.TITLE_MISMATCH}: "
                f"« {(hints.get(item.id) or {}).get('title')} » matched « {item.title} »"
            )
        item.store()
        try:
            item.write()
        except Exception as exc:  # DB is authoritative; file tags are best-effort
            protocol.log(f"enrich_album: tag write failed: {exc}")
        try:
            item.move()
        except Exception as exc:
            protocol.log(f"enrich_album: move failed: {exc}")
        if not had_genre and pause > 0 and done < total:
            time.sleep(pause)
        # track_done is the per-row completion signal the UI keys on.
        protocol.send_event(
            request_id,
            "enrich_progress",
            {"stage": "track_done", "done": done, "total": total, "item_id": item.id},
        )

    return album, mapped


def _adopt_bonus_tracks(request_id: str, lib, album, match, leftovers, recordings: dict, pause: float, hints: dict) -> list:
    """Adopt leftovers whose recording lives on a sibling edition of the voted
    release's release-group (deluxe, regional): real title and track metadata
    from their own edition, album identity and folder from the main one,
    numbered after the last real slot. Returns the adopted items."""
    group_id = match.info.releasegroup_id
    if not group_id:
        return []
    plugin = metadata.mb_plugin()

    # Which sibling releases could host each leftover.
    candidates: dict[int, dict[str, tuple[dict, str]]] = {}  # item_id -> {release_id: (release, rec_id)}
    by_item = {item.id: item for item in leftovers}
    for item in leftovers:
        found: dict[str, tuple[dict, str]] = {}
        for rec_id in recordings.get(item.id) or []:
            try:
                rec = plugin.mb_api.get_recording(rec_id, includes=["releases", "release-groups"])
            except Exception as exc:
                protocol.log(f"enrich_album: recording {rec_id} failed: {exc}")
                continue
            for release in rec.get("releases", []) if isinstance(rec, dict) else []:
                rg = release.get("release_group") or {}
                if release.get("id") and rg.get("id") == group_id:
                    found.setdefault(release["id"], (release, rec_id))
        if found:
            candidates[item.id] = found

    # Prefer few editions over many: repeatedly pick the sibling covering the
    # most still-pending leftovers (release_rank breaks ties).
    assignments: dict[str, list[tuple]] = {}  # release_id -> [(item, rec_id)]
    pending = set(candidates)
    while pending:
        counts: dict[str, dict] = {}
        for item_id in pending:
            for release_id, (release, _) in candidates[item_id].items():
                counts.setdefault(release_id, {"n": 0, "release": release})
                counts[release_id]["n"] += 1
        best = sorted(
            counts, key=lambda rid: (-counts[rid]["n"], metadata.release_rank(counts[rid]["release"]))
        )[0]
        for item_id in sorted(pending):
            if best in candidates[item_id]:
                _, rec_id = candidates[item_id][best]
                assignments.setdefault(best, []).append((by_item[item_id], rec_id))
                pending.discard(item_id)

    adopted: list = []
    lastgenre = metadata.lastgenre_plugin()
    next_track = len(match.info.tracks)
    for release_id, pairs in assignments.items():
        try:
            info = plugin.album_for_id(release_id)
        except Exception as exc:
            protocol.log(f"enrich_album: sibling release {release_id} failed: {exc}")
            info = None
        if info is None:
            continue
        tracks_by_id = {t.track_id: t for t in info.tracks}
        protocol.log(f"enrich_album: adopting {len(pairs)} bonus track(s) from {info.album}")
        pairs.sort(key=lambda p: tracks_by_id[p[1]].index or 0)
        for item, rec_id in pairs:
            track = tracks_by_id.get(rec_id)
            if track is None:
                continue
            next_track += 1
            # merge_with_album(match.info) is the adoption itself: track-level
            # fields from the bonus edition, album-level from the main release.
            item.update(enrich.work_fields(track.merge_with_album(match.info)))
            item.track = next_track
            item.album_id = album.id
            # Where the bonus really comes from — surfaced in the UI so the
            # iTunes/Spotify-style filing stays explicit to the user.
            item["sonarche_bonus_source"] = info.album
            genres, label = lastgenre._get_genre(item)
            if genres:
                item.genres = genres
                protocol.log(f"enrich_album: genre {genres} ({label})")
            # Adopted through its own AcoustID recording on a sibling edition.
            provenance.mark_match(item, "acoustid")
            suspect.mark(item, (hints.get(item.id) or {}).get("title"))
            item.store()
            try:
                item.write()
            except Exception as exc:
                protocol.log(f"enrich_album: tag write failed: {exc}")
            try:
                item.move()
            except Exception as exc:
                protocol.log(f"enrich_album: move failed: {exc}")
            protocol.send_event(
                request_id, "enrich_progress", {"stage": "track_done", "item_id": item.id}
            )
            adopted.append(item)
    return adopted


def _fetch_album_cover(
    album, items, release_id: str | None, release_group_id: str | None = None
) -> None:
    if not release_id:
        return
    try:
        protocol.log(f"enrich_album: fetching cover for release {release_id}")
        cover = enrich.download_cover(release_id, release_group_id)
        if cover is not None:
            hq, thumb = cover
            enrich.set_album_art(album, *thumb)
            enrich.save_hq_cover(album, *hq)
            for item in items:
                enrich.embed_cover(item, *thumb)
            protocol.log(
                f"enrich_album: cover stored (hq on disk, 500px embedded in {len(items)} file(s))"
            )
    except Exception as exc:  # metadata landed; a missing cover is not a failure
        protocol.log(f"enrich_album: cover fetch failed: {exc}")


def _build_reports(lib, items) -> list[dict]:
    reports = []
    for item in items:
        fresh = lib.get_item(item.id)
        reports.append({"item_id": item.id, "report": build_report(fresh) if fresh else None})
    return reports


def _adopt_art(keep, dying) -> None:
    """Move a dying row's cover files into the kept row's directory when the
    kept row has none — otherwise the files are stale copies; delete them so
    the emptied folder can be pruned instead of surviving on cover.jpg alone."""
    import shutil

    art = enrich._decode(dying.artpath) if dying.artpath else None
    if not art or not os.path.exists(art):
        return
    src_dir = os.path.dirname(art)
    covers = [art] + [
        os.path.join(src_dir, name)
        for name in os.listdir(src_dir)
        if name.startswith("cover-hq.")
    ]
    keep_art = enrich._decode(keep.artpath) if keep.artpath else None
    if keep_art and os.path.exists(keep_art):
        for path in covers:
            try:
                os.remove(path)
            except OSError as exc:
                protocol.log(f"enrich_album: stale cover removal failed: {exc}")
    else:
        dest_dir = enrich._decode(keep.item_dir())
        for path in covers:
            try:
                shutil.move(path, os.path.join(dest_dir, os.path.basename(path)))
            except OSError as exc:
                protocol.log(f"enrich_album: cover relocation failed: {exc}")
        keep.artpath = os.path.join(dest_dir, os.path.basename(art))
        keep["art_source"] = dying.get("art_source") or keep.get("art_source")
        keep.store()
    try:
        if not os.listdir(src_dir):
            os.rmdir(src_dir)
    except OSError:
        pass


def _consolidate_album_rows(lib, items) -> list:
    """One album row per MusicBrainz release, library-wide.

    Two ways sibling rows appear: per-track enrichment creates one row per
    enrich_one call, and separate *jobs* used to create one row per import of
    the same release (the single, then the playlist carrying it). Either way
    beets' %aunique starts suffixing every folder ("Album [7]", …) and each row
    drags its own cover. For every release the batch touched, keep the row
    holding the most items, reattach the others' items (wherever they came
    from), drop the empty rows, and re-move the files — with the dead siblings
    gone, %aunique yields the clean folder name again."""
    touched: set[str] = set()
    for item in items:
        fresh = lib.get_item(item.id)
        if fresh is not None and fresh.mb_albumid and fresh.album_id is not None:
            touched.add(fresh.mb_albumid)

    from beets.dbcore.query import MatchQuery

    albums = []
    for release_id in touched:
        rows = list(lib.albums(MatchQuery("mb_albumid", release_id)))
        if not rows:
            continue
        members = {row.id: list(row.items()) for row in rows}
        keep = max(rows, key=lambda row: (len(members[row.id]), -row.id))
        for row in rows:
            if row.id == keep.id:
                continue
            protocol.log(
                f"enrich_album: merging album row {row.id} into {keep.id} ({release_id})"
            )
            for item in members[row.id]:
                item.album_id = keep.id
                item.store()
                members[keep.id].append(item)
            _adopt_art(keep, row)
            row.remove(delete=False, with_items=False)
        art_dir_before = (
            os.path.dirname(enrich._decode(keep.artpath)) if keep.artpath else None
        )
        # Re-move every item now that the sibling rows are gone.
        for item in members[keep.id]:
            try:
                item.move()
            except Exception as exc:
                protocol.log(f"enrich_album: move failed: {exc}")
        covers.follow_hq_cover(lib, keep, art_dir_before, enrich._decode)
        albums.append(keep)
    return albums


def _enrich_per_track(
    request_id: str, lib, items, params: dict, pause: float, recordings: dict | None = None
) -> bool:
    """Per-track enrichment loop (full batch or an album match's leftovers).
    Covers are deferred to _finalize_fallback: tracks landing on the same
    release share one album row and one Cover Art Archive fetch.

    `recordings` is the batch's own fingerprint work ({item_id: [recording
    ids]}): handing it down means a track already fingerprinted upstream never
    pays fpcalc and the AcoustID round-trip a second time."""
    hints = {h["item_id"]: h for h in params.get("track_hints") or []}
    any_matched = False
    total = len(items)
    for done, item in enumerate(items, start=1):
        hint = hints.get(item.id) or {}
        track_params = {**params, "title": hint.get("title"), "artist": params.get("artist")}
        try:
            # Both the cover and the unidentified-file guess are deferred to the
            # batch: it knows the album row and the release the siblings matched.
            result = enrich.enrich_one(
                request_id,
                lib,
                item,
                track_params,
                fetch_cover=False,
                provisional_fallback=False,
                known_recordings=(recordings or {}).get(item.id),
            )
        except Exception as exc:  # one bad track must not sink the rest
            protocol.log(f"enrich_album: item {item.id} enrich failed: {exc}")
            result = {"matched": False}
        any_matched = any_matched or bool(result.get("matched"))
        protocol.send_event(
            request_id,
            "enrich_progress",
            {"stage": "track_done", "done": done, "total": total, "item_id": item.id},
        )
        if pause > 0 and done < total:
            time.sleep(pause)
    return any_matched


def _finalize_fallback(lib, items) -> None:
    """Regroup same-release rows, then fetch covers still missing (an album
    already covered by the album-match path keeps its art, no second CAA hit)."""
    for album in _consolidate_album_rows(lib, items):
        artpath = enrich._decode(album.artpath) if album.artpath else None
        if artpath and os.path.exists(artpath):
            continue
        _fetch_album_cover(
            album, list(album.items()), album.mb_albumid, album.mb_releasegroupid
        )


def _embed_album_cover(album, item) -> None:
    """Give a provisionally-tagged track the album's existing cover. The CAA
    fetch already ran for the batch, so this is a local copy — no second hit."""
    if album is None or not album.artpath:
        return
    path = enrich._decode(album.artpath)
    if not os.path.exists(path):
        return
    try:
        with open(path, "rb") as f:
            data = f.read()
        enrich.embed_cover(item, data, data[:4] == b"\x89PNG")
    except Exception as exc:
        protocol.log(f"enrich_album: cover embed failed: {exc}")


def _tag_unidentified(lib, album, items, params: dict) -> None:
    """Fill and flag whatever survived the per-track fallback unidentified.

    With an album row in hand the guess borrows the release the siblings did
    match — album, artist, date, cover — so the orphan files itself next to the
    tracks it arrived with instead of landing blank under Non-Album/. Runs last,
    after the album rows have been consolidated: these items claim the release's
    mb_albumid and must not be regrouped on the strength of a guess."""
    hints = {h["item_id"]: h for h in params.get("track_hints") or []}
    for item in items:
        fresh = lib.get_item(item.id)
        if fresh is None or fresh.mb_trackid:
            continue
        hint = hints.get(item.id) or {}
        track_params = {"title": hint.get("title"), "artist": params.get("artist")}
        if enrich.apply_provisional(lib, fresh, track_params, album=album):
            _embed_album_cover(album, fresh)


def _handle_forced(
    request_id: str,
    lib,
    items,
    params: dict,
    pause: float,
    forced: dict,
    duplicate_reports: list,
    recordings: dict,
) -> dict:
    """The user named the record; identify the tracks, then file them under it.

    No release vote and no text search: both exist to answer "what album is
    this?", which the user has just answered. What the per-track pass is still
    worth is everything below the album — title, artist, genre, year — which is
    exactly what makes the artist column readable once the album name stops
    coming from MusicBrainz.

    The provisional fill runs *before* the album is forced, because it parks a
    zero in `track` on purpose; forcing afterwards is what puts the playlist
    position back."""
    protocol.log(f"enrich_album: album forced to « {forced['title']} », per-track identification")
    any_matched = _enrich_per_track(request_id, lib, items, params, pause, recordings)
    _tag_unidentified(lib, None, items, params)

    fresh = [item for item in (lib.get_item(i.id) for i in items) if item is not None]
    album = forced_album.apply(lib, fresh, forced)
    provisional_cover = forced_album.ensure_cover(lib, album, fresh, forced)

    return {
        "matched": any_matched,
        "mode": "forced",
        "provisional_cover": provisional_cover,
        "reports": _build_reports(lib, fresh) + duplicate_reports,
    }


def handle(request_id: str, params: dict) -> dict:
    from beets.library import Library

    lib = Library(params["beets_db"], directory=params["library_dir"])
    items = []
    seen: set[int] = set()
    for item_id in params["item_ids"]:
        if item_id in seen:  # defensive: a duplicated id would wreck the mapping
            continue
        seen.add(item_id)
        item = lib.get_item(item_id)
        if item is None:
            raise RuntimeError(f"item not found: {item_id}")
        items.append(item)
    if not items:
        raise RuntimeError("no items to enrich")

    metadata.ensure_plugins()
    pause = max(0.0, float(params.get("fetch_pause_seconds", _DEFAULT_FETCH_PAUSE_SECONDS)))
    forced = forced_album.requested(params)

    duplicate_reports: list[dict] = []
    recordings: dict[int, list[str]] = {}
    if params.get("acoustid_key"):
        recordings = _fingerprint_all(request_id, items, params)
        items, duplicates = _remove_duplicates(request_id, lib, items, recordings)
        # A forced album is a compilation the user is assembling on purpose, so
        # a track they already own under its original release is not a mistake
        # to drop — dropping it would hand them a record with a hole in it and
        # no way to see why. Two copies of the same recording *inside the
        # playlist* stay a mis-upload either way, so that pass above still runs.
        if not forced:
            items, library_duplicates = _remove_library_duplicates(
                request_id, lib, items, recordings
            )
            duplicates.update(library_duplicates)
        duplicate_reports = [
            {"item_id": item_id, "duplicate_of": kept_id, "report": None}
            for item_id, kept_id in sorted(duplicates.items())
        ]
        if not items:
            return {"matched": False, "mode": "none", "reports": duplicate_reports}
    else:
        protocol.log("enrich_album: no AcoustID key configured, text search only")

    hints = {h["item_id"]: h for h in params.get("track_hints") or []}
    _apply_hints(items, hints, params.get("artist"))

    if forced:
        return _handle_forced(
            request_id, lib, items, params, pause, forced, duplicate_reports, recordings
        )

    match, leftovers = None, []
    source = None
    if recordings:
        protocol.send_event(request_id, "enrich_progress", {"stage": "match"})
        release_id = _vote_release_id(request_id, items, recordings, pause)
        if release_id:
            protocol.log(f"enrich_album: fingerprints voted release {release_id}")
            match, leftovers = _build_match(items, recordings, release_id)
            source = "acoustid"
        if match is not None and leftovers:
            match, leftovers = _rescue_coverage(request_id, items, recordings, match, leftovers)
        if match is not None and leftovers:
            leftovers = _rescue_slots(match, leftovers, hints)
    if match is None:
        match, leftovers = _text_album_match(request_id, items, params), []
        source = "text" if match is not None else None

    if match is not None:
        album, mapped = _apply_album(request_id, lib, match, pause, source, hints)
        adopted = (
            _adopt_bonus_tracks(request_id, lib, album, match, leftovers, recordings, pause, hints)
            if leftovers
            else []
        )
        _fetch_album_cover(
            album, mapped + adopted, match.info.album_id, match.info.releasegroup_id
        )
        rest = [i for i in leftovers if i.id not in {a.id for a in adopted}]
        if rest:
            protocol.log(f"enrich_album: {len(rest)} leftover track(s), per-track fallback")
            _enrich_per_track(request_id, lib, rest, params, pause, recordings)
        _finalize_fallback(lib, mapped + adopted + rest)
        if rest:
            _tag_unidentified(lib, album, rest, params)
        reports = _build_reports(lib, mapped + adopted + rest) + duplicate_reports
        return {"matched": True, "mode": "album", "reports": reports}

    protocol.log("enrich_album: no album-level match, falling back per track")
    any_matched = _enrich_per_track(request_id, lib, items, params, pause, recordings)
    _finalize_fallback(lib, items)
    # No release was ever voted, so there is nothing to borrow: each survivor
    # gets only what its own video knew.
    _tag_unidentified(lib, None, items, params)
    return {
        "matched": any_matched,
        "mode": "per_track" if any_matched else "none",
        "reports": _build_reports(lib, items) + duplicate_reports,
    }
