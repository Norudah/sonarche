import type { LibraryTrack } from "@/features/library/api";

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Free-text search over the fields the list actually shows. Every whitespace
 * separated term must match somewhere, so "daft disc" finds Digital Love. */
export function filterTracks(tracks: LibraryTrack[], query: string): LibraryTrack[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return tracks;

  return tracks.filter((track) => {
    const haystack = normalize(
      [track.title, track.artist, track.album, track.albumArtist, track.genre ?? ""].join(" "),
    );
    return terms.every((term) => haystack.includes(term));
  });
}

/** Total playtime, split for i18n: a locale decides how to write "21 h 08". */
export function totalPlaytime(tracks: LibraryTrack[]): { hours: number; minutes: number } {
  const seconds = tracks.reduce((sum, track) => sum + (track.length ?? 0), 0);
  const totalMinutes = Math.round(seconds / 60);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
