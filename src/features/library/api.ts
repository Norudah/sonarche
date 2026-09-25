import { convertFileSrc, invoke } from "@tauri-apps/api/core";

/** Adds a version to a stable image URL to bust the webview cache. `data:`
 * URIs (mock preview) are left untouched. */
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
  /** beets album id; null for singletons. */
  albumId: number | null;
  /** The 500px display cover. */
  artUrl: string | null;
  /** Path on disk, for the OS Now Playing panel. */
  artPath: string | null;
  /** Origin release of an adopted bonus track. */
  bonusSource: string | null;
  /** Null when never matched; a shared id means the same audio twice. */
  mbTrackId: string | null;
  /** The match contradicts the download's title; flagged for review. */
  suspectMatch: boolean;
  /** The cover is a video thumbnail placeholder. */
  provisionalCover: boolean;
  /** beets `grouping`: context (Video Games, Film…), not style. Canonical
   * English values. Not counted in completeness. */
  category: string | null;
  /** MusicBrainz release type: cue to suggest a category. */
  soundtrack: boolean;
  /** Null reads as an album. */
  albumKind: AlbumKind | null;
  /** Checks accepted on this track. */
  accepted: AcceptedCheck[];
  /** Checks accepted on the track's album. */
  albumAccepted: AcceptedCheck[];
}

/** Checks that can be accepted. Not "suspect" (needs a look) nor tracklist
 * gaps (handled by `AlbumKind`). */
export type AcceptedCheck = "year" | "track" | "genre" | "duplicates" | "artwork";

/** Only an album can be missing tracks. */
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

/** Albums a running download will file into. */
export async function listDownloadTargetAlbums(): Promise<number[]> {
  return invoke<number[]>("download_target_albums");
}

/** Editable tags by beets attribute name, validated by the Rust command.
 * Values are strings; the sidecar coerces them. */
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

/** Several ids: one UI card can span several album rows. */
export async function setAlbumKind(albumIds: number[], kind: AlbumKind): Promise<{ updated: number }> {
  return invoke<{ updated: number }>("set_album_kind", { albumIds, kind });
}

/** Exactly one of `targetAlbumId` / `newAlbum`. `itemIds` order is the
 * numbering order when `renumber` is on. */
export interface MoveSpec {
  itemIds: number[];
  targetAlbumId?: number;
  newAlbum?: { album: string; albumartist: string };
  /** Sets the target's kind in the same pass. */
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

/** Files follow on disk. */
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

export interface GenreOverride {
  genre: string;
  family: string;
}

/** `null` restores the base tree. No track is modified. Returns the new placement. */
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

/** Source pixels, after EXIF orientation. */
export interface CoverCrop {
  left: number;
  top: number;
  size: number;
}

/** Grants the asset scope for preview; returns the file size. */
export async function allowCoverPreview(path: string): Promise<{ path: string; bytes: number; url: string }> {
  const result = await invoke<{ path: string; bytes: number }>("allow_cover_preview", { path });
  return { ...result, url: convertFileSrc(result.path) };
}

/** The current cover as a crop source. */
export async function albumRecropSource(artPath: string): Promise<{ path: string; bytes: number }> {
  return invoke("album_recrop_source", { artPath });
}

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

/** A thumbnail data URL (the CSP allows no remote images) and the full-size URL. */
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

/** Keyed by albumartist. The filename is stable, so `updated_at` busts the cache. */
export interface ArtistImage {
  name: string;
  url: string;
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

/** Downloads a pasted image URL to a temp file (the sidecar checks it). Used
 * for covers too, despite the command's name. */
export async function fetchImageUrl(url: string): Promise<{ path: string; bytes: number }> {
  return invoke("fetch_artist_image_url", { url });
}

export async function savePastedImage(bytes: Uint8Array): Promise<{ path: string; bytes: number }> {
  return invoke("save_pasted_image", bytes);
}

export interface RemuxReport {
  scanned: number;
  fragmented: number;
  remuxed: number;
  /** Retried next launch. */
  failed: string[];
  /** Set when the one-time relayout ran: every path changed. */
  relayouted?: number;
}

/** Remuxes fragmented DASH m4a files into classic MP4. Idempotent. */
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
    // Versioned by mtime: a replaced cover keeps its path.
    artUrl: track.art_path
      ? convertFileSrc(track.art_path) + (track.art_mtime != null ? `?v=${track.art_mtime}` : "")
      : null,
    artPath: track.art_path,
    bonusSource: track.bonus_source,
    mbTrackId: track.mb_trackid,
    suspectMatch: track.suspect_match,
    provisionalCover: track.provisional_cover ?? false,
    category: track.category,
    soundtrack: track.soundtrack,
    albumKind: track.album_kind ?? null,
    accepted: track.accepted ?? [],
    albumAccepted: track.album_accepted ?? [],
  }));
}
