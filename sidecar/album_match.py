"""Identifying an album's MusicBrainz release: the pure vote and mapping,
and the lookups that feed them."""

import time

import metadata
import protocol
import suspect

# Each sample costs a few MusicBrainz calls (~1 req/s).
_MAX_SAMPLES = 3


# Tolerates trims/silence; a wrong mapping is usually a different song.
_MAX_DURATION_DIFF_SECONDS = 20.0


# No fingerprint safety net for text search: near-perfect hits only.
_MAX_TEXT_ALBUM_DISTANCE = 0.15


def vote_release(release_sets: list[list[dict]], track_count: int) -> str | None:
    """Pick the release id best supported by the sampled fingerprints.

    `release_sets` holds one list of MB releases per sampled track. Ties break
    on exact track count, then `release_rank`.
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
        # The key name depends on the MB client's normalization.
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
    """Alternative releases for leftovers the voted release doesn't cover,
    ranked by how many leftovers each could host. `exclude` is never returned."""
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
    """Seat leftovers onto the voted release's empty tracks when both the video
    title and the duration agree. Returns {item: track}, nearest duration wins.

    Leftovers were fingerprinted to a sibling edition's recording (e.g. another
    language), so neither signal is trusted alone; title agreement without both
    lengths seats nothing."""
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


def find_content_duplicates(recording_lists: list[tuple[int, list[str]]]) -> dict[int, int]:
    """{duplicate item id: kept item id} for items sharing the same primary
    AcoustID recording. First occurrence wins.

    Only the primary recording counts: secondary matches are often mislinked
    and can be shared by genuinely different tracks."""
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


def cover_with_editions(candidates: dict[int, dict[str, tuple[dict, str]]]) -> dict[str, list]:
    """Greedy cover: the fewest sibling editions holding the most leftovers.

    `candidates` maps item_id -> {release_id: (release, rec_id)}. Returns
    release_id -> [(item_id, rec_id)]; ties go to the better-ranked release."""
    assignments: dict[str, list] = {}
    pending = set(candidates)
    while pending:
        counts: dict[str, dict] = {}
        for item_id in pending:
            for release_id, (release, _) in candidates[item_id].items():
                counts.setdefault(release_id, {"n": 0, "release": release})
                counts[release_id]["n"] += 1
        best = min(
            counts,
            key=lambda rid: (-counts[rid]["n"], metadata.release_rank(counts[rid]["release"])),
        )
        for item_id in sorted(pending):
            if best in candidates[item_id]:
                _, rec_id = candidates[item_id][best]
                assignments.setdefault(best, []).append((item_id, rec_id))
                pending.discard(item_id)
    return assignments


def match_by_recordings(items, tracks, recordings_by_item: dict) -> tuple[dict, list, list]:
    """Map items to release tracks. Returns (mapping, leftover_items, extra_tracks).

    1. Recording id match.
    2. Nearest duration, only for items AcoustID could not identify.
    3. A lone leftover takes a lone empty slot."""
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

    # Elimination: covers video rips that resolve to the single's recording and
    # run long. The majority guard keeps genuine bonus tracks out of free slots.
    if len(leftovers) == 1 and len(remaining) == 1 and len(mapping) > len(items) / 2:
        mapping[leftovers[0]] = remaining[0]
        leftovers, remaining = [], []

    return mapping, leftovers, remaining


def vote_release_id(request_id: str, items, recordings: dict, pause: float) -> str | None:
    """Vote among the releases of a few identified items, spread across the batch."""
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
                # beets' client paces MusicBrainz (~1 req/s).
                rec = plugin.mb_api.get_recording(rec_id, includes=["releases", "release-groups"])
                releases.extend(rec.get("releases", []) if isinstance(rec, dict) else [])
            except Exception as exc:
                protocol.log(f"enrich_album: recording {rec_id} failed: {exc}")
        if releases:
            release_sets.append(releases)
        if pause > 0 and done < total - 1:
            time.sleep(pause)
    return vote_release(release_sets, len(items))


def build_match(items, recordings: dict, release_id: str):
    """(AlbumMatch, leftovers) on the voted release, or (None, items) unless a
    majority of the files map onto it."""
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
        protocol.log(f"enrich_album: {len(leftovers)} track(s) off the voted release")
    match = AlbumMatch(
        distance=Distance(),
        info=album_info,
        mapping=mapping,
        extra_items=list(leftovers),
        extra_tracks=extra_tracks,
    )
    return match, leftovers


# Rescue budget: releases re-tested, and recordings resolved per leftover.
_MAX_RESCUE_RELEASES = 2


_MAX_RESCUE_RECORDINGS = 3


def rescue_coverage(request_id: str, items, recordings: dict, match, leftovers):
    """Switch to a leftover's own release when it maps strictly more files.

    The vote ranks by AcoustID popularity, which is wrong when two editions
    share fingerprints; identified files that don't fit the voted release are
    the tell."""
    plugin = metadata.mb_plugin()
    release_sets: list[list[dict]] = []
    for item in leftovers:
        releases: list[dict] = []
        for rec_id in (recordings.get(item.id) or [])[:_MAX_RESCUE_RECORDINGS]:
            try:
                rec = plugin.mb_api.get_recording(rec_id, includes=["releases", "release-groups"])
                releases.extend(rec.get("releases", []) if isinstance(rec, dict) else [])
            except Exception as exc:
                protocol.log(f"enrich_album: recording {rec_id} failed: {exc}")
        if releases:
            release_sets.append(releases)

    candidates = rescue_candidates(release_sets, exclude=match.info.album_id)
    for release_id in candidates[:_MAX_RESCUE_RELEASES]:
        candidate, candidate_leftovers = build_match(items, recordings, release_id)
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


def rescue_slots(match, leftovers, hints: dict) -> list:
    """Apply `slot_rescues` to the match in place. Returns unseated leftovers."""
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


def text_album_match(request_id: str, items, params: dict):
    """Text search fallback: only a complete, near-perfect match is trusted."""
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
