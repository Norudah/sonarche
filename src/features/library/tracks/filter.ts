import type { LibraryTrack } from "@/features/library/api";
import { createTextFilter } from "@/shared/lib/search";

/** Free-text search over the fields the list actually shows. Every whitespace
 * separated term must match somewhere, so "daft disc" finds Digital Love. */
export const filterTracks = createTextFilter<LibraryTrack>((track) =>
  [track.title, track.artist, track.album, track.albumArtist, track.genre ?? ""].join(" "),
);

/** Total playtime, split for i18n: a locale decides how to write "21 h 08". */
export function totalPlaytime(tracks: LibraryTrack[]): { hours: number; minutes: number } {
  const seconds = tracks.reduce((sum, track) => sum + (track.length ?? 0), 0);
  const totalMinutes = Math.round(seconds / 60);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
