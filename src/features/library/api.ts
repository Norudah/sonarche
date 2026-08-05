import { convertFileSrc, invoke } from "@tauri-apps/api/core";

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
}

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
}

export async function deleteTrack(id: number): Promise<void> {
  await invoke("delete_track", { id });
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

export async function reenrichTrack(id: number): Promise<{ matched: boolean }> {
  const result = await invoke<{ matched: boolean }>("reenrich_track", { id });
  return { matched: result.matched };
}

export async function recomputeGenres(): Promise<{ total: number; updated: number }> {
  return invoke<{ total: number; updated: number }>("recompute_genres");
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

export async function setAlbumCover(
  albumId: number,
  sourcePath: string,
  crop: CoverCrop | null,
): Promise<{ art_path: string | null; side: number; embedded: number }> {
  return invoke("set_album_cover", { albumId, sourcePath, crop });
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
  }));
}
