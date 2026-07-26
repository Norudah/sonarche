import type { Album } from "@/features/library/albums/albums";
import type { LibraryTrack } from "@/features/library/api";

/**
 * The tracks a detail page is *about* — its own, never whole albums.
 *
 * A shelf album qualifies on a single matching track, so flattening the shelf
 * would smuggle in everything else on those records: "play Grunge" would play
 * the ballads filed beside it, and a half-tagged OST would lend its untagged
 * half to the queue. The predicate is applied again per track for that reason.
 *
 * Album order first, tracks keeping their album order — the queue then reads
 * like the shelf above it. The library is the fallback for the case that shelf
 * cannot express: a subject whose every track is a minority on a record filed
 * elsewhere has no albums at all, and it must still be playable and browsable.
 *
 * Callers memoise the result. `facetsOf` caches on the array's identity, so a
 * fresh array per render would quietly defeat that cache.
 */
export function scopeTracks(
  albums: Album[],
  library: LibraryTrack[],
  matches: (track: LibraryTrack) => boolean,
): LibraryTrack[] {
  return albums.length > 0 ? albums.flatMap((album) => album.tracks.filter(matches)) : library.filter(matches);
}
