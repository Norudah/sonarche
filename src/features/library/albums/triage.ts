import type { Album } from "@/features/library/albums/albums";

/** The albums page's triage deep links (`triagePaths` in `@/app/paths`). */
export interface AlbumTriage {
  missingArtwork: boolean;
  tracklistGaps: boolean;
}

export function parseAlbumTriage(params: URLSearchParams): AlbumTriage {
  return {
    missingArtwork: params.get("missing") === "artwork",
    tracklistGaps: params.get("tracklist") === "gaps",
  };
}

/** A hole in 1…expected (declared total, else highest number). Albums without
 * any number, and collections, never match. */
export function hasTracklistGaps(album: Album): boolean {
  if (album.kind === "collection") return false;

  const numbers = new Set<number>();
  let expected = 0;
  for (const track of album.tracks) {
    if (track.track != null && track.track > 0) numbers.add(track.track);
    if (track.trackTotal != null) expected = Math.max(expected, track.trackTotal);
  }
  if (numbers.size === 0) return false;

  for (const number of numbers) expected = Math.max(expected, number);
  for (let slot = 1; slot <= expected; slot += 1) {
    if (!numbers.has(slot)) return true;
  }
  return false;
}

/** Every active filter narrows (as in `applyTrackTriage`). */
export function applyAlbumTriage(albums: Album[], triage: AlbumTriage): Album[] {
  let result = albums;
  if (triage.missingArtwork)
    result = result.filter((album) => album.artUrl == null && !album.accepted.includes("artwork"));
  if (triage.tracklistGaps) result = result.filter(hasTracklistGaps);
  return result;
}
