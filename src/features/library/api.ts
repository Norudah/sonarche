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
  artUrl: string | null;
  /** Origin release title when the track is a bonus adopted into this album
   * (deluxe/regional edition filed with the main album), else null. */
  bonusSource: string | null;
  /** MusicBrainz recording id of the applied match, null when never matched.
   * Two tracks sharing one id are the same audio filed twice. */
  mbTrackId: string | null;
  /** The match contradicts the download's own title (cross-language
   * fingerprint collisions): surfaced by the metadata triage as "to review". */
  suspectMatch: boolean;
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
  art_path: string | null;
  bonus_source: string | null;
  mb_trackid: string | null;
  suspect_match: boolean;
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
    artUrl: track.art_path ? convertFileSrc(track.art_path) : null,
    bonusSource: track.bonus_source,
    mbTrackId: track.mb_trackid,
    suspectMatch: track.suspect_match,
  }));
}
