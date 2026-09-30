import type { Album } from "@/features/library/albums/albums";
import type { LibraryTrack } from "@/features/library/api";

/**
 * A detail page's own tracks, never whole albums (an album qualifies on one
 * matching track, so each track is tested again). Album order first; the
 * library is the fallback when no album qualifies. Callers memoise the result,
 * or `facetsOf`'s identity cache breaks.
 */
export function scopeTracks(
  albums: Album[],
  library: LibraryTrack[],
  matches: (track: LibraryTrack) => boolean,
): LibraryTrack[] {
  return albums.length > 0 ? albums.flatMap((album) => album.tracks.filter(matches)) : library.filter(matches);
}
