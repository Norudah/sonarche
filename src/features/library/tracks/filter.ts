import type { LibraryTrack } from "@/features/library/api";
import { createTextFilter } from "@/shared/lib/search";

/** Every term must match one of the shown fields ("daft disc" → Digital Love). */
export const filterTracks = createTextFilter<LibraryTrack>((track) =>
  [track.title, track.artist, track.album, track.albumArtist, track.genre ?? ""].join(" "),
);

/** Split for i18n ("21 h 08"). */
export function totalPlaytime(tracks: LibraryTrack[]): { hours: number; minutes: number } {
  const seconds = tracks.reduce((sum, track) => sum + (track.length ?? 0), 0);
  const totalMinutes = Math.round(seconds / 60);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
