import { invoke } from "@tauri-apps/api/core";

import type { Album } from "@/features/library/albums/albums";

/** Kept in wire casing: the plan goes back to the sidecar verbatim on apply. */
export interface AlignPlanAlbum {
  album_id: number;
  album: string;
  albumartist: string;
  release_id: string;
  release_group_id: string | null;
  release_title: string;
  release_artist: string;
  release_year: number | null;
  cover_missing: boolean;
  /** MusicBrainz genres, seeded through the genre pipeline; not counted as fills. */
  items: { item_id: number; fills: Record<string, string | number>; genres?: string[] }[];
  album_fills: Record<string, string | number>;
}

export interface AlignPlan {
  scanned: number;
  matched: number;
  albums: AlignPlanAlbum[];
}

export interface AlignResult {
  albumsUpdated: number;
  itemsUpdated: number;
  coversFetched: number;
  genresFilled: number;
}

export async function alignScan(): Promise<AlignPlan> {
  return invoke<AlignPlan>("library_align_scan");
}

export async function alignApply(plan: AlignPlan): Promise<AlignResult> {
  const raw = await invoke<{
    albums_updated: number;
    items_updated: number;
    covers_fetched: number;
    genres_filled: number;
  }>("library_align_apply", { plan });
  return {
    albumsUpdated: raw.albums_updated,
    itemsUpdated: raw.items_updated,
    coversFetched: raw.covers_fetched,
    genresFilled: raw.genres_filled,
  };
}

/** Albums identified, fields to write, covers to fetch. */
export function summarizePlan(plan: AlignPlan): { albums: number; fields: number; covers: number } {
  let fields = 0;
  let covers = 0;
  for (const album of plan.albums) {
    fields += Object.keys(album.album_fills).length;
    for (const item of album.items) fields += Object.keys(item.fills).length;
    if (album.cover_missing) covers += 1;
  }
  return { albums: plan.albums.length, fields, covers };
}

/** Albums with no MusicBrainz-matched track: a front-side proxy for what the
 * scan targets (album rows without a release id). */
export function unidentifiedAlbumCount(albums: Album[]): number {
  return albums.filter((album) => album.tracks.every((track) => track.mbTrackId == null)).length;
}
