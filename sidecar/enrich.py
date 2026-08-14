"""Enrich an imported item with trusted metadata from its acoustic fingerprint.

fpcalc computes the Chromaprint locally (no network), AcoustID resolves it to
the exact MusicBrainz recording — this is what picks the studio version over
live/covers that plague text search — then the recording is expanded to its
canonical release for album, year, track number, genre and cover art. Text
search is only a conservative fallback, applied when it is near-certain."""

import json
import os
import subprocess
import tempfile

import covers
import metadata
import protocol
import provenance
import provisional
import suspect
from report import build_report

_ACOUSTID_LOOKUP = "https://api.acoustid.org/v2/lookup"
# AcoustID answers with a confidence score; below this we trust nothing.
_MIN_SCORE = 0.6
# The text fallback has no fingerprint safety net: only apply near-perfect hits.
_MAX_TEXT_DISTANCE = 0.10
# Fingerprints occasionally map to several recordings; try the best few. Five
# rather than three so a less-submitted sibling (the French edition of a song
# whose English version dominates AcoustID) stays in the candidate set — the
# album batch's coverage check can only pick a release its recordings reached.
_MAX_RECORDINGS = 5


def _decode(value) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def _decode_path(item) -> str:
    return _decode(item.path)


# The sidecar is spawned by a GUI process, so on Windows it has no console of
# its own — and a console child started from there gets one allocated, which
# means a black window flashing once per track through an album enrichment.
# The flag is Windows-only and the attribute does not exist elsewhere.
_NO_WINDOW = {"creationflags": subprocess.CREATE_NO_WINDOW} if hasattr(subprocess, "CREATE_NO_WINDOW") else {}


def _fingerprint(fpcalc: str, path: str) -> tuple[int, str]:
    proc = subprocess.run(
        [fpcalc, "-json", path],
        capture_output=True,
        text=True,
        # fpcalc echoes the file path in its JSON, so its output carries
        # whatever the track is called. Left to the locale this decodes as
        # cp1252 on Windows and one accent ends the fingerprint.
        encoding="utf-8",
        errors="replace",
        timeout=60,
        **_NO_WINDOW,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"fpcalc failed (exit {proc.returncode}): {proc.stderr.strip()[:200]}"
        )
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
    results = sorted(
        payload.get("results", []), key=lambda r: r.get("score", 0), reverse=True
    )
    for result in results:
        if result.get("score", 0) < _MIN_SCORE:
            continue
        # The score rates the fingerprint match, not each recording: one
        # fingerprint often links to several recordings, including bogus user
        # submissions. `sources` counts the submissions backing each link —
        # the real recording dwarfs the mislinked ones.
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


# The three verdicts the video's title can pass on a candidate, in sort order.
_TITLE_NAMES = 0  # shares a real word with the video title
_TITLE_NEUTRAL = 1  # no evidence either way (junk or empty titles)
_TITLE_CONTRADICTS = 2  # both carry words, none shared


def candidate_sort_key(
    title_hint: str | None, candidate_title: str | None, release: dict
) -> tuple:
    """How much to trust one candidate recording; lower is better. Pure.

    The video's own title outranks the release type. AcoustID's crowd data
    mislinks confusable recordings (language versions, or two songs off one
    soundtrack whose fingerprints someone cross-submitted), and submission
    count then puts the wrong song first — « Real Gone » landed as
    « Sleepin' on the Foldout » with the right title sitting in candidate slot
    two. A candidate the video names beats any candidate it contradicts; the
    release rank (studio album over best-of, earliest date) only arbitrates
    within the same title verdict. Junk titles cost nothing: both sides
    reduced to noise judge every candidate neutral, which is the old order."""
    if suspect.titles_agree(title_hint, candidate_title):
        verdict = _TITLE_NAMES
    elif suspect.is_title_mismatch(title_hint, candidate_title):
        verdict = _TITLE_CONTRADICTS
    else:
        verdict = _TITLE_NEUTRAL
    return (verdict, metadata.release_rank(release))


def is_settled(key: tuple, title_hint: str | None) -> bool:
    """Whether a candidate is unbeatable, ending the scan early: a clean studio
    album (no unwanted secondary type, primary rank 0) that the video's title
    vouches for — or, when the hint carries no usable words, on rank alone."""
    verdict, rank = key
    confirmed = verdict == _TITLE_NAMES or not suspect.has_words(title_hint)
    return confirmed and not rank[0] and rank[1] == 0


def _text_fallback(item, artist_hint: str | None, title_hint: str | None) -> str | None:
    """Search MusicBrainz by name using the YouTube hints. In-memory only:
    nothing is stored unless a near-perfect match is applied afterwards."""
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


# Fields a TrackInfo carries that describe the *file*, not the work. beets fills
# these from the audio itself at import time and they must survive tagging.
_FILE_FIELDS = ("length",)


def work_fields(merged) -> dict:
    """A matched TrackInfo, stripped of anything that describes the audio file.

    `length` on a TrackInfo is MusicBrainz' duration for the recording, and the
    file we downloaded from YouTube is never quite that: measured across the
    library the two disagree by anywhere from a few tenths of a second to half a
    minute, in both directions — different masters, a trailing outro, silence at
    the end of a video. Copying it over `item.length` replaced a fact about our
    file with a fact about someone else's, and everything downstream inherited
    the lie: tracklist durations, the player's seek bar, and `_pair_plausible` in
    enrich_album, which compares a file's length against a candidate track's and
    whose own variable is called `file_length`.

    The item's own `length` is read from the audio at import and is correct.
    Nothing about matching a release should overwrite it.
    """
    return {key: value for key, value in dict(merged).items() if key not in _FILE_FIELDS}


def find_album_row(lib, release_id: str | None):
    """The library's existing album row for a MusicBrainz release id, or None.
    One release, one row: every path that files a matched item goes through
    this before creating a new row, so two jobs landing on the same release
    stop growing sibling rows (and %aunique stops suffixing their folders)."""
    from beets.dbcore.query import MatchQuery

    if not release_id:
        return None
    for album in lib.albums(MatchQuery("mb_albumid", release_id)):
        return album
    return None


def find_named_row(lib, albumartist: str | None, album_title: str | None):
    """The library's album row wearing exactly this albumartist + album, or
    None. The fallback behind `find_album_row`: the app groups albums by name,
    so two editions of one album standing up two rows is never a state the
    user can see — only a folder split, because %aunique suffixes every row
    sharing a name. One name, one row.

    Collections are never returned (a gathering the user named is not a
    landing spot for a matched release), nor blank names (every provisional
    row is blank; they have nothing in common). When the pathology already
    exists — several rows with the name — the fullest row wins, same rule as
    the consolidation pass."""
    import library
    from beets.dbcore.query import AndQuery, MatchQuery

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
    return max(rows, key=lambda row: (len(list(row.items())), -row.id))


def _album_row_for(lib, item):
    """The album row `item` belongs on now that its tags are (re)written.

    A match can change the item's release (re-enrich flipping an edition):
    rewriting the row it happens to sit on would rename the folder under its
    siblings' feet. Instead the item joins the library's row for its new
    release — reusing an existing one, else a fresh one — and the row it left
    is dropped once empty."""
    album = item.get_album()
    release_id = item.mb_albumid or ""
    if not release_id or (album is not None and (album.mb_albumid or "") == release_id):
        # Singleton items (album-batch tracks that fell back to per-track
        # enrich) have no album row at all: without one, the cover fetch
        # bails out and the file lands under Non-Album/. Create it, exactly
        # like a regular -A import would have.
        return album if album is not None else lib.add_album([item])

    # The exact release first; failing that, the row wearing the same name —
    # another edition of the same album, which must share its folder rather
    # than stand up a %aunique-suffixed sibling.
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
        album.remove(delete=False, with_items=False)
    return target


def store_and_file(lib, item, sync_album: bool = True) -> None:
    """Persist the item, push its tags to the file, make sure it belongs to an
    album row, and move it to the path its metadata now dictates.

    `sync_album=False` is for an item joining an album row that already carries
    trusted metadata (a provisional track filed next to its matched siblings):
    the row must not be rewritten from the item that borrowed it."""
    from beets import library

    item.store()
    try:
        item.write()
    except Exception as exc:  # DB is authoritative; file tags are best-effort
        protocol.log(f"enrich: tag write failed: {exc}")

    # Sync the album row BEFORE moving. Two reasons, both stemming from the
    # as-is import leaving the album row's own album/albumartist/genres empty:
    #   1. Item.destination() reads album-level fields ($albumartist/$album/…)
    #      from the album ROW, not the item. With a blank row, $album collapses
    #      to nothing and the file lands in <albumartist>/ with no album folder.
    #      Every album by one artist then shares that directory — and thus a
    #      single cover.jpg — so each enrichment overwrites the previous album's
    #      cover. Syncing first gives each album its own <artist>/<album>/ dir.
    #   2. beets' duplicate check keys on albumartist+album; two blank rows look
    #      like duplicates, making it skip every later untagged import.
    album = _album_row_for(lib, item)
    if sync_album:
        for key in library.Album.item_keys:
            album[key] = item[key]
        album.store()

    try:
        # Metadata changed, so the path format (Artist/Album/nn Title) changed too.
        item.move()
    except Exception as exc:
        protocol.log(f"enrich: move failed: {exc}")


def _file_as_singleton(lib, item) -> None:
    """File a guess that no record claims outside the shelves: no album row,
    so beets' `singleton` path (the guessed zone, `À identifier/`) applies.

    This path used to force an album row instead, and with a blank title the
    row's folder had no name — %aunique could only tell the blanks apart by
    row id, and every guessed single stood as `<channel>/[86]/`. A blank row a
    prior run left the item on is dropped once it empties."""
    old_row = item.get_album()
    if item.album_id is not None:
        item.album_id = None
    item.store()
    try:
        item.write()
    except Exception as exc:  # DB is authoritative; file tags are best-effort
        protocol.log(f"enrich: tag write failed: {exc}")
    if old_row is not None and not list(old_row.items()):
        old_row.remove(delete=False, with_items=False)
    try:
        item.move()
    except Exception as exc:
        protocol.log(f"enrich: move failed: {exc}")


def apply_provisional(lib, item, params: dict, album=None) -> bool:
    """Nothing identified this file: fill it from the download's own hints (and
    from `album`, when its siblings matched a release) and flag it as a guess.
    With an album behind it, it files next to the siblings that vouch for it;
    with nothing behind it, it files in the guessed zone rather than posing on
    the shelves as a verified record.

    Returns whether anything was written."""
    fields = provisional.guess_fields(
        title=params.get("title"),
        artist=params.get("artist"),
        album_fields=provisional.album_fields(album) if album is not None else None,
    )
    if not provisional.apply(item, fields):
        protocol.log(f"enrich: item {item.id} unidentified and no hint to guess from")
        return False
    protocol.log(f"enrich: item {item.id} provisionally tagged from {sorted(fields)}")
    if album is not None:
        item.album_id = album.id
        store_and_file(lib, item, sync_album=False)
        return True

    current = item.get_album()
    if current is not None and (str(current.album) or "").strip():
        # It already sits on a named record (a re-run that failed to match):
        # keep it where it is, and keep the row's own words — a guess must not
        # rewrite them.
        store_and_file(lib, item, sync_album=False)
    else:
        _file_as_singleton(lib, item)
    return True


def _apply(lib, item, album_info, track_info) -> None:
    # merge_with_album already carries the release's `genres` list along.
    merged = track_info.merge_with_album(album_info)
    item.update(work_fields(merged))

    # Genre: MB community tags ride along in `genres` and canonicalize against
    # our tree offline; when MB gave nothing, _get_genre falls back to a
    # Last.fm fetch (its client swallows network errors and returns []).
    # An empty result means nothing resolved: keep the raw MB genre (it may
    # simply be off-whitelist) rather than erasing it.
    #
    # Hand-edited genres are NOT spared, deliberately: a re-match rewrites
    # every tag it recognises, and the confirmation dialog upstream is what
    # says so — sparing fields quietly would make its warning a lie. The bulk
    # genre recompute (`genres.assign`) keeps its own hand-edit guard; that
    # pass runs without a per-item warning.
    genres, label = metadata.lastgenre_plugin()._get_genre(item)
    if genres:
        item.genres = genres
        protocol.log(f"enrich: genre {genres} ({label})")

    store_and_file(lib, item)


def _caa_front(entity_path: str) -> tuple[bytes, bool] | None:
    """The 500px front cover from one Cover Art Archive entity (`release/<id>`
    or `release-group/<id>`) as (data, is_png), or None when that entity
    carries no front art. CAA's own rendition first — the full upload is only
    fetched when no rendition exists, and `set_album_art` shrinks it locally;
    since the archive convention went, nothing keeps the original anyway."""
    import requests

    import cover_set
    import net

    for variant in ("front-500", "front"):
        resp = requests.get(f"https://coverartarchive.org/{entity_path}/{variant}", timeout=30, stream=True)
        if resp.status_code != 200:
            continue
        try:
            data = net.read_bounded(resp, cover_set.MAX_CANDIDATE_BYTES)
        except RuntimeError:
            # An outsized upload degrades to "no cover", never to a failed enrich.
            protocol.log(f"enrich: cover on {entity_path}/{variant} over the size cap, skipped")
            continue
        if data:
            return data, data[:4] == b"\x89PNG"
    return None


def download_cover(release_id: str, release_group_id: str | None = None) -> tuple[bytes, bool] | None:
    """The display cover from the Cover Art Archive, or None — the 500px
    rendition used as beets' artpath (cover.jpg) and embedded into file tags,
    so the beets copy and the audio files stay light.

    Tries the specific release first, then the release-group's designated cover.
    Many streaming/regional releases carry no per-release art while their group
    does — without this fallback, popular albums landed with no cover at all."""
    cover = _caa_front(f"release/{release_id}")
    if cover is not None:
        return cover
    protocol.log(f"enrich: no per-release cover for {release_id}")
    if release_group_id:
        cover = _caa_front(f"release-group/{release_group_id}")
        if cover is not None:
            protocol.log(f"enrich: cover found on release-group {release_group_id}")
            return cover
        protocol.log(f"enrich: no cover on release-group {release_group_id} either")
    return None


def set_album_art(album, data: bytes, is_png: bool, source: str = "Cover Art Archive") -> None:
    """Set beets' artpath (cover.jpg) — expects the 500px thumb, so the beets
    copy stays light. `source` records where the picture came from: a forced
    album may fall back to a video thumbnail, and the row should not claim the
    Cover Art Archive gave it one."""
    with tempfile.NamedTemporaryFile(suffix=".png" if is_png else ".jpg", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        album.set_art(tmp_path, copy=True)
        album["art_source"] = source
        album.store()
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
    # The ceiling holds whatever arrived: the CAA fallback hands over the full
    # upload when no 500px rendition exists, and an oversized artpath is the
    # exact memory bill the rendition rule exists to prevent.
    if album.artpath:
        covers.ensure_display_rendition(_decode(album.artpath))


def embed_cover(item, data: bytes, is_png: bool) -> None:
    from mutagen.mp4 import MP4, MP4Cover

    path = _decode_path(item)
    if path.endswith(".m4a") and os.path.exists(path):
        tags = MP4(path)
        fmt = MP4Cover.FORMAT_PNG if is_png else MP4Cover.FORMAT_JPEG
        tags["covr"] = [MP4Cover(data, imageformat=fmt)]
        tags.save()


def _fetch_cover(item, release_id: str, release_group_id: str | None = None) -> None:
    album = item.get_album()
    if album is None:
        return
    cover = download_cover(release_id, release_group_id)
    if cover is None:
        return
    set_album_art(album, *cover)
    embed_cover(item, *cover)


def handle(request_id: str, params: dict) -> dict:
    from beets.library import Library

    import library

    lib = Library(params["beets_db"], directory=params["library_dir"])
    item = lib.get_item(params["item_id"])
    if item is None:
        raise RuntimeError(f"item not found: {params['item_id']}")

    # A collection is its owner's gathering, not a release: there is nothing to
    # be matched against, and this chain re-files a matched item onto its
    # release's album row (`_album_row_for`) — which would rip the track out of
    # the record someone placed it in. The UI greys the button and says why;
    # this guard is what makes the promise hold whatever calls in.
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
    """Fingerprint-first enrichment of one item. Caller owns the Library and
    must have called metadata.ensure_plugins(). `params` carries fpcalc,
    acoustid_key and the optional title/artist hints. `fetch_cover=False`
    lets the album batch fetch one cover per album instead of per track;
    `provisional_fallback=False` likewise defers the unidentified-file guess to
    the album batch, which can borrow its siblings' release.

    `known_recordings` short-circuits the fingerprint+lookup with recording ids
    the album batch already resolved for this very file: without it, every
    track the batch handed to the per-track pass paid fpcalc and the AcoustID
    round-trip a second time. An empty list is a real answer (fingerprinted,
    nothing above the score bar) — only None means "not looked up yet"."""
    path = _decode_path(item)
    if not os.path.exists(path):
        raise RuntimeError(f"file not found: {path}")

    recordings: list[str] = []
    fingerprinted = False
    api_key = params.get("acoustid_key")
    if known_recordings is not None:
        recordings = known_recordings
        fingerprinted = True
    elif api_key:
        # item_id lets the album batch's UI animate the matching child row.
        protocol.send_event(
            request_id, "enrich_progress", {"stage": "fingerprint", "item_id": item.id}
        )
        duration, fingerprint = _fingerprint(params["fpcalc"], path)
        fingerprinted = True
        protocol.send_event(
            request_id, "enrich_progress", {"stage": "lookup", "item_id": item.id}
        )
        recordings = _lookup_recordings(api_key, fingerprint, duration)
        protocol.log(f"enrich: acoustid returned {len(recordings)} recording(s)")
    else:
        protocol.log("enrich: no AcoustID key configured, text fallback only")

    # One fingerprint resolves to several recordings (MB keeps a separate
    # recording for the album version and for each best-of it lands on), ordered
    # by AcoustID submission count. Picking the first that resolves tags whatever
    # release happens to top that list — often a compilation. Score every
    # candidate's canonical release and keep the best.
    #
    # The video's own title outranks the release type. AcoustID's crowd data
    # mislinks confusable recordings (language versions, or two songs off one
    # soundtrack whose fingerprints someone cross-submitted), and submission
    # count then puts the wrong song first — « Real Gone » landed as
    # « Sleepin' on the Foldout » with the right title sitting in candidate
    # slot two. A candidate whose title shares a word with the video's beats
    # any candidate that contradicts it; the release rank only arbitrates
    # within the same title verdict. Junk titles cost nothing: both sides
    # reduced to noise judge every candidate "neutral", which is the old order.
    title_hint = params.get("title")
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
        # A clean studio album the video's title vouches for (or, with no
        # usable hint, any clean studio album): nothing later can beat it.
        if is_settled(key, title_hint):
            break
    if track_info is not None and best_key is not None and best_key[0] == _TITLE_CONTRADICTS:
        protocol.log(
            f"enrich: no candidate matched the video title « {title_hint} », "
            f"keeping best-ranked « {track_info.title} »"
        )

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
        protocol.send_event(
            request_id, "enrich_progress", {"stage": "apply", "item_id": item.id}
        )
        # Read before _apply rewrites it: whether this match lands on the
        # release the item already wore.
        previous_release = str(item.mb_albumid or "")
        _apply(lib, item, album_info, track_info)
        if fetch_cover:
            # A re-match confirming the same release must not stomp the cover
            # the album already wears — the user may have replaced it by hand.
            # A changed release is a changed record: fetch as before.
            album = item.get_album()
            same_release = bool(previous_release) and previous_release == str(
                album_info.album_id or ""
            )
            if same_release and album is not None and album.artpath:
                protocol.log("enrich: release unchanged and cover present, keeping it")
            else:
                try:
                    _fetch_cover(item, album_info.album_id, album_info.releasegroup_id)
                except Exception as exc:  # metadata landed; a missing cover is not a failure
                    protocol.log(f"enrich: cover fetch failed: {exc}")
    elif provisional_fallback:
        apply_provisional(lib, item, params)

    # Re-read: _text_fallback may have mutated the in-memory item without storing.
    fresh = lib.get_item(item.id)
    if fresh is not None and (fingerprinted or matched):
        # Provenance goes on the fresh row, never the in-memory item: the item
        # may carry the fallback's unstored hint mutations.
        if fingerprinted:
            provenance.mark_fingerprinted(fresh)
        if matched and source:
            # The tags stop being guesses the moment a real match vouches for
            # them — a provisional track re-matched later must drop its flag.
            if provisional.clear(fresh):
                protocol.log(f"enrich: item {item.id} no longer provisional")
            provenance.mark_match(fresh, source)
            if suspect.mark(fresh, params.get("title")):
                protocol.log(
                    f"enrich: item {item.id} flagged {suspect.TITLE_MISMATCH}: "
                    f"« {params.get('title')} » matched « {fresh.title} »"
                )
        fresh.store()
    return {"matched": matched, "report": build_report(fresh) if fresh else None}
