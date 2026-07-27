import type { LibraryTrack } from "@/features/library/api";

/**
 * A narrowing of the tracklist, raised by the completion card.
 *
 * It carries its own label because the thing that sets it is also the thing that
 * knows how to name it — the filter bar just states what it was handed, and the
 * id is only there so pressing the same chip twice clears it.
 */
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
