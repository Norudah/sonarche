import type { LibraryTrack } from "@/features/library/api";

/** A tracklist narrowing set by the completion card, carrying its own label;
 * `id` lets the same chip toggle it off. */
export interface TrackFilter {
  id: string;
  label: string;
  trackIds: number[];
}

export function applyTrackFilter(tracks: LibraryTrack[], filter: TrackFilter | null): LibraryTrack[] {
  if (!filter) return tracks;
  const wanted = new Set(filter.trackIds);
  return tracks.filter((track) => wanted.has(track.id));
}
