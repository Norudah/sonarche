import type { Album } from "@/features/library/albums/albums";

/** The albums page's side of the triage deep links (`triagePaths` in
 * `@/app/paths`). */
export interface AlbumTriage {
  /** `?missing=artwork` */
  missingArtwork: boolean;
  /** `?tracklist=gaps` */
  tracklistGaps: boolean;
}

export function parseAlbumTriage(params: URLSearchParams): AlbumTriage {
  return {
    missingArtwork: params.get("missing") === "artwork",
    tracklistGaps: params.get("tracklist") === "gaps",
  };
}

/**
 * A hole in the numbered sequence 1…expected, where `expected` is the declared
 * track total when any track carries one, else the highest number present. An
 * album with no numbered track at all has no sequence to have holes in — that
 * is a missing-tags problem, not a gapped tracklist.
 *
 * And a collection has no tracklist at all. Whatever it holds is what its owner
 * chose to put in it, so "track 7 is missing" is not a defect but a
 * misunderstanding of the record — the check does not apply and never fires.
 */
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

/** Same composition rule as `applyTrackTriage`: every active filter narrows. */
export function applyAlbumTriage(albums: Album[], triage: AlbumTriage): Album[] {
  let result = albums;
  if (triage.missingArtwork) result = result.filter((album) => album.artUrl == null);
  if (triage.tracklistGaps) result = result.filter(hasTracklistGaps);
  return result;
}
