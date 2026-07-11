import { convertFileSrc, invoke } from "@tauri-apps/api/core";

export interface LibraryTrack {
  id: number;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  year: number | null;
  length: number | null;
  bitrate: number | null;
  format: string;
  path: string;
  audioUrl: string;
  artUrl: string | null;
}

interface WireTrack {
  id: number;
  title: string;
  artist: string;
  album: string;
  album_artist: string;
  year: number | null;
  length: number | null;
  bitrate: number | null;
  format: string;
  path: string;
  art_path: string | null;
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
    length: track.length,
    bitrate: track.bitrate,
    format: track.format,
    path: track.path,
    audioUrl: convertFileSrc(track.path),
    artUrl: track.art_path ? convertFileSrc(track.art_path) : null,
  }));
}
