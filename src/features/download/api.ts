import { invoke } from "@tauri-apps/api/core";

export interface StagedTrack {
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  duration: number | null;
  webpageUrl: string | null;
  thumbnail: string | null;
}

interface WireDownloadResult {
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  duration: number | null;
  webpage_url: string | null;
  thumbnail: string | null;
}

export async function downloadTrack(url: string): Promise<StagedTrack> {
  const raw = await invoke<WireDownloadResult>("download_track", { url });
  return {
    path: raw.path,
    title: raw.title,
    artist: raw.artist,
    album: raw.album,
    duration: raw.duration,
    webpageUrl: raw.webpage_url,
    thumbnail: raw.thumbnail,
  };
}

export async function importTrack(path: string): Promise<void> {
  await invoke("import_track", { path });
}
