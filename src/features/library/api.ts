import { convertFileSrc, invoke } from "@tauri-apps/api/core";

/** Version a stable-named image URL so a replaced picture escapes the
 * webview's cache. Left untouched for `data:` URIs — the mock preview inlines
 * its images, and a query string would corrupt the document they carry. */
export function withCacheBuster(url: string, version: number): string {
  return url.startsWith("data:") ? url : `${url}?v=${version}`;
}

export interface LibraryTrack {
  id: number;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  year: number | null;
  genre: string | null;
  genreBucket: string | null;
  track: number | null;
  trackTotal: number | null;
  length: number | null;
  bitrate: number | null;
  format: string;
  path: string;
  audioUrl: string;
  /** beets' own album id — the identity cover operations key on. Null for a
   * singleton, which has no album row to hang a cover on. */
  albumId: number | null;
  /** The album cover at display size (beets' 500px rendition), not the CAA
   * original we archive beside it. Every surface draws it at 384px or less, so
   * there is no call site the original would serve better — see
   * `art_paths_by_album` in the sidecar. */
  artUrl: string | null;
  /** The cover's path on disk. The asset URL above is for drawing; this is for
   * the OS Now Playing panel, which is given a path and builds its own URL. */
  artPath: string | null;
  /** Origin release title when the track is a bonus adopted into this album
   * (deluxe/regional edition filed with the main album), else null. */
  bonusSource: string | null;
  /** MusicBrainz recording id of the applied match, null when never matched.
   * Two tracks sharing one id are the same audio filed twice. */
  mbTrackId: string | null;
  /** The match contradicts the download's own title (cross-language
   * fingerprint collisions): surfaced by the metadata triage as "to review". */
  suspectMatch: boolean;
  /** The album's cover is the video's thumbnail rather than real artwork — a
   * forced album whose media had none on the Cover Art Archive. Right shape,
   * wrong picture: the album panel says so and points at replacing it. */
  provisionalCover: boolean;
  /** The user's own axis (beets' grouping tag): context — Video Games, Film…
   * — not musical style. Canonical English values; the UI translates known
   * taxonomy entries. Optional by nature: not counted in tag completeness. */
  category: string | null;
  /** MusicBrainz typed the release a soundtrack: the drawer's cue to
   * pre-suggest a category (MB can't tell film from game). */
  soundtrack: boolean;
  /** What the record this track sits on is, as its owner declared it. Null
   * until someone says otherwise, which reads as an album. */
  albumKind: AlbumKind | null;
  /** Checks the owner has answered on this track: seen, and wanted as it is.
   * They stop counting on the metadata page — see `AcceptedCheck`. */
  accepted: AcceptedCheck[];
  /** The same, carried by the track's album for the whole record. */
  albumAccepted: AcceptedCheck[];
}

/** A verdict someone can legitimately mean to leave standing. "Match to review"
 * is not one of them (it asks what the audio is, and the answer is to look),
 * and neither is a gapped tracklist (a record with no tracklist is a
 * collection, which says so once — see `AlbumKind`). */
export type AcceptedCheck = "year" | "track" | "genre" | "duplicates" | "artwork";

/** A release with a tracklist, or somebody's own gathering of tracks. The
 * distinction is not cosmetic: only the first can be missing a track. */
export type AlbumKind = "album" | "collection";

interface WireTrack {
  id: number;
  title: string;
  artist: string;
  album: string;
  album_artist: string;
  year: number | null;
  genre: string | null;
  genre_bucket: string | null;
  track: number | null;
  track_total: number | null;
  length: number | null;
  bitrate: number | null;
  format: string;
  path: string;
  album_id?: number | null;
  art_path: string | null;
  art_mtime?: number | null;
  bonus_source: string | null;
  mb_trackid: string | null;
  suspect_match: boolean;
  provisional_cover?: boolean;
  category: string | null;
  soundtrack: boolean;
  album_kind?: AlbumKind | null;
  accepted?: AcceptedCheck[];
  album_accepted?: AcceptedCheck[];
}

export async function deleteTrack(id: number): Promise<void> {
  await invoke("delete_track", { id });
}

/** beets album ids a download still in flight is going to file tracks into.
 * The library's one input from the queue — nothing else here knows a job. */
export async function listDownloadTargetAlbums(): Promise<number[]> {
  return invoke<number[]>("download_target_albums");
}

/** Beets attribute names for the tags an edit may touch — the wire contract the
 * Rust command validates against. Every value travels as a string; the sidecar
 * coerces `year`/`track`/`tracktotal` and collapses `genre` into its column. */
export interface TrackFieldPatch {
  title?: string;
  artist?: string;
  albumartist?: string;
  album?: string;
  year?: string;
  track?: string;
  tracktotal?: string;
  genre?: string;
  grouping?: string;
}

export interface TrackUpdate {
  id: number;
  fields: TrackFieldPatch;
}

export async function updateTracks(updates: TrackUpdate[]): Promise<{ updated: number }> {
  return invoke<{ updated: number }>("update_tracks", { updates });
}

/** Declare what these beets albums are. Ids rather than one album, because a
 * card on screen is a (artist, title) group and can stand for several rows. */
export async function setAlbumKind(albumIds: number[], kind: AlbumKind): Promise<{ updated: number }> {
  return invoke<{ updated: number }>("set_album_kind", { albumIds, kind });
}

/** One move request: what goes where, as what, numbered how. Exactly one of
 * `targetAlbumId` / `newAlbum`; `itemIds` order is the numbering order when
 * `renumber` is on. */
export interface MoveSpec {
  itemIds: number[];
  targetAlbumId?: number;
  newAlbum?: { album: string; albumartist: string };
  /** Declares the target's nature in the same pass; omitted leaves it be. */
  kind?: AlbumKind;
  renumber?: boolean;
}

export interface MoveResult {
  moved: number;
  skipped: number;
  created: boolean;
  targetAlbumId: number;
  sourcesRemoved: number;
}

/** Refile tracks onto another record — the files follow on disk. */
export async function moveTracks(spec: MoveSpec): Promise<MoveResult> {
  const raw = await invoke<{
    moved: number;
    skipped: number;
    created: boolean;
    target_album_id: number;
    sources_removed: number;
  }>("move_tracks", { spec });
  return {
    moved: raw.moved,
    skipped: raw.skipped,
    created: raw.created,
    targetAlbumId: raw.target_album_id,
    sourcesRemoved: raw.sources_removed,
  };
}

/** Answer a check on a batch of objects, or take the answer back. */
export async function setCheckAccepted(
  scope: "track" | "album",
  ids: number[],
  check: AcceptedCheck,
  accepted: boolean,
): Promise<{ updated: number }> {
  return invoke<{ updated: number }>("set_check_accepted", { scope, ids, check, accepted });
}

export async function reenrichTrack(id: number): Promise<{ matched: boolean }> {
  const result = await invoke<{ matched: boolean }>("reenrich_track", { id });
  return { matched: result.matched };
}

export async function recomputeGenres(): Promise<{ total: number; updated: number }> {
  return invoke<{ total: number; updated: number }>("recompute_genres");
}

/** A placement the user made: this genre files under that family. */
export interface GenreOverride {
  genre: string;
  family: string;
}

/** File a genre under a family of the user's choosing, or return it to the
 * base tree (family = null). No track is touched — the read path rebuckets on
 * its own. Returns where the genre files after the change. */
export async function setGenreFamily(
  genre: string,
  family: string | null,
): Promise<{ genre: string; family: string | null; overridden: boolean }> {
  return invoke<{ genre: string; family: string | null; overridden: boolean }>("set_genre_family", {
    genre,
    family,
  });
}

export async function listGenreOverrides(): Promise<GenreOverride[]> {
  const result = await invoke<{ overrides: GenreOverride[] }>("list_genre_overrides");
  return result.overrides;
}

/** The square to cut from a replacement cover, in source pixels after EXIF
 * orientation — the frame the preview showed. */
export interface CoverCrop {
  left: number;
  top: number;
  size: number;
}

/** Admit a user-picked image into the asset scope so the modal can preview it,
 * and learn its weight for the size line. */
export async function allowCoverPreview(path: string): Promise<{ path: string; bytes: number; url: string }> {
  const result = await invoke<{ path: string; bytes: number }>("allow_cover_preview", { path });
  return { ...result, url: convertFileSrc(result.path) };
}

/** The album's own cover as a file to reframe — the display rendition,
 * admitted to the asset scope so the crop stage can reopen it. */
export async function albumRecropSource(artPath: string): Promise<{ path: string; bytes: number }> {
  return invoke("album_recrop_source", { artPath });
}

/** What replaces the cover: a local file (with its crop) or a Cover Art
 * Archive upload picked from the candidates. */
export type CoverSource = { sourcePath: string; crop: CoverCrop | null } | { candidateUrl: string };

export async function setAlbumCover(
  albumId: number,
  source: CoverSource,
): Promise<{ art_path: string | null; side: number; embedded: number }> {
  return invoke("set_album_cover", {
    albumId,
    sourcePath: "sourcePath" in source ? source.sourcePath : null,
    crop: "sourcePath" in source ? source.crop : null,
    candidateUrl: "candidateUrl" in source ? source.candidateUrl : null,
  });
}

/** One Cover Art Archive upload the album could wear instead. The thumbnail is
 * a data URL (the webview's CSP allows no remote images); `imageUrl` is what a
 * selection sends back for the sidecar to download full-size. */
export interface CoverCandidate {
  id: string;
  thumb: string;
  imageUrl: string;
  front: boolean;
  types: string[];
}

export async function listCoverCandidates(albumId: number): Promise<CoverCandidate[]> {
  const raw = await invoke<{
    candidates: { id: string; thumb: string; image_url: string; front: boolean; types: string[] }[];
  }>("list_cover_candidates", { albumId });
  return raw.candidates.map((candidate) => ({
    id: candidate.id,
    thumb: candidate.thumb,
    imageUrl: candidate.image_url,
    front: candidate.front,
    types: candidate.types,
  }));
}

/** The image an artist wears, keyed by the exact albumartist string the shelf
 * groups on. The file lives in the library's `Artwork/Artists/` under the
 * artist's own name — stable across replacements, so `updated_at` rides the
 * URL as the cache buster (same trick as album covers). */
export interface ArtistImage {
  name: string;
  url: string;
  /** The file itself — what reframing the image already in place reopens. */
  path: string;
}

export async function listArtistImages(): Promise<ArtistImage[]> {
  const raw = await invoke<{ images: { name: string; path: string; updated_at: number }[] }>("list_artist_images");
  return raw.images.map((image) => ({
    name: image.name,
    url: withCacheBuster(convertFileSrc(image.path), image.updated_at),
    path: image.path,
  }));
}

export async function setArtistImage(
  name: string,
  sourcePath: string,
  crop: CoverCrop | null,
): Promise<{ name: string; filename: string }> {
  return invoke("set_artist_image", { name, sourcePath, crop });
}

export async function removeArtistImage(name: string): Promise<{ removed: boolean }> {
  return invoke("remove_artist_image", { name });
}

/** Download a pasted image link into a temp file (sidecar-side: https only,
 * size cap, magic-byte sniff) — the modal then adopts the path exactly like a
 * local pick, same crop, same rendition. The command kept its historical name
 * from the artist modal, but the download is source-agnostic: covers ride the
 * same path. */
export async function fetchImageUrl(url: string): Promise<{ path: string; bytes: number }> {
  return invoke("fetch_artist_image_url", { url });
}

/** Raw clipboard image bytes, landed as a temp file the picker can adopt. */
export async function savePastedImage(bytes: Uint8Array): Promise<{ path: string; bytes: number }> {
  return invoke("save_pasted_image", bytes);
}

export interface RemuxReport {
  scanned: number;
  fragmented: number;
  remuxed: number;
  /** Basenames of files the pass could not repair; retried on next launch. */
  failed: string[];
  /** Records the one-time zones relayout re-filed, when that pass ran this
   * launch — every path and artUrl in the library changed under the app. */
  relayouted?: number;
}

/** One-shot repair pass: remux fragmented DASH m4a files (downloads made
 * before the app bundled ffmpeg) into classic MP4s that Music.app, iOS and
 * CarPlay can read. Idempotent — a healthy library answers in seconds. */
export function remuxLibrary(): Promise<RemuxReport> {
  return invoke<RemuxReport>("remux_library");
}

export async function listLibrary(): Promise<LibraryTrack[]> {
  const raw = await invoke<{ tracks: WireTrack[] }>("list_library");
  return raw.tracks.map((track) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    albumArtist: track.album_artist,
    year: track.year,
    genre: track.genre,
    genreBucket: track.genre_bucket,
    track: track.track,
    trackTotal: track.track_total,
    length: track.length,
    bitrate: track.bitrate,
    format: track.format,
    path: track.path,
    audioUrl: convertFileSrc(track.path),
    albumId: track.album_id ?? null,
    // Versioned by the cover file's mtime: artpath keeps its name when the
    // picture behind it is replaced, and an unversioned URL would let the
    // webview's cache show the old pixels forever.
    artUrl: track.art_path
      ? convertFileSrc(track.art_path) + (track.art_mtime != null ? `?v=${track.art_mtime}` : "")
      : null,
    artPath: track.art_path,
    bonusSource: track.bonus_source,
    mbTrackId: track.mb_trackid,
    suspectMatch: track.suspect_match,
    // Absent from a library read by a build that predates forced albums.
    provisionalCover: track.provisional_cover ?? false,
    category: track.category,
    soundtrack: track.soundtrack,
    // Absent from a library read by a build that predates the distinction —
    // and absent, on any build, for every album nobody has re-declared.
    albumKind: track.album_kind ?? null,
    accepted: track.accepted ?? [],
    albumAccepted: track.album_accepted ?? [],
  }));
}
