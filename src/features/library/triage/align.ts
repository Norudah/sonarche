import { invoke } from "@tauri-apps/api/core";

import type { Album } from "@/features/library/albums/albums";

/**
 * One album entry of the scan's plan, kept in wire casing on purpose: the plan
 * is a round-trip document — it goes back to the sidecar verbatim on apply, and
 * the sidecar re-validates every field of it at write time. Mapping it to front
 * casing would mean un-mapping it again, with a bug waiting in each direction.
 */
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
  /** `genres` are MusicBrainz' community genres for the mapped track — seeded
   * through the genre pipeline at apply time, never counted as a fill. */
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

/** What the verdict announces: albums identified, fields the fill would write
 * (items and album rows together), covers it would fetch. Pure. */
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

/**
 * The idle line's count: albums where no track carries a MusicBrainz match.
 * A proxy — the scan keys on the album row's own release id, which the front
 * never loads — but it moves the same way: filling a plan writes mb_trackid on
 * the very tracks counted here. Pure.
 */
export function unidentifiedAlbumCount(albums: Album[]): number {
  return albums.filter((album) => album.tracks.every((track) => track.mbTrackId == null)).length;
}
