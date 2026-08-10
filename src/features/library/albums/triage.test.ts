import { describe, expect, it } from "vitest";

import { triagePaths } from "@/app/paths";
import { groupAlbums, type Album } from "@/features/library/albums/albums";
import {
  applyAlbumTriage,
  hasTracklistGaps,
  parseAlbumTriage,
  type AlbumTriage,
} from "@/features/library/albums/triage";
import { track } from "@/features/library/testFixtures";

function paramsOf(path: string): URLSearchParams {
  return new URLSearchParams(path.split("?")[1]);
}

function triage(over: Partial<AlbumTriage> = {}): AlbumTriage {
  return { missingArtwork: false, tracklistGaps: false, ...over };
}

/** One album derived the way the page derives it, from its tracks. */
function albumOf(numbers: (number | null)[], over: Parameters<typeof track>[0] = {}): Album {
  return groupAlbums(
    numbers.map((n, i) => track({ id: i + 1, album: "Album", artist: "Artist", track: n, ...over })),
  )[0];
}

describe("parseAlbumTriage", () => {
  it("round-trips the published deep links", () => {
    expect(parseAlbumTriage(paramsOf(triagePaths.missingArtwork))).toEqual(triage({ missingArtwork: true }));
    expect(parseAlbumTriage(paramsOf(triagePaths.tracklistGaps))).toEqual(triage({ tracklistGaps: true }));
  });

  it("is inert on unrelated or unknown params", () => {
    expect(parseAlbumTriage(new URLSearchParams(""))).toEqual(triage());
    expect(parseAlbumTriage(new URLSearchParams("missing=year"))).toEqual(triage());
  });
});

describe("hasTracklistGaps", () => {
  it("is calm on a complete 1…N sequence", () => {
    expect(hasTracklistGaps(albumOf([1, 2, 3]))).toBe(false);
  });

  it("flags a hole inside the sequence", () => {
    expect(hasTracklistGaps(albumOf([1, 3]))).toBe(true);
  });

  it("flags tracks missing against the declared total", () => {
    expect(hasTracklistGaps(albumOf([1, 2, 3], { trackTotal: 12 }))).toBe(true);
    expect(hasTracklistGaps(albumOf([1, 2, 3], { trackTotal: 3 }))).toBe(false);
  });

  it("has no verdict on an album with no numbered track", () => {
    expect(hasTracklistGaps(albumOf([null, null]))).toBe(false);
  });

  /** The whole point of the distinction: the same tracklist, judged or left
   * alone depending on what its owner said the record is. */
  it("never faults a collection for what it does not contain", () => {
    expect(hasTracklistGaps(albumOf([1, 3]))).toBe(true);
    expect(hasTracklistGaps(albumOf([1, 3], { albumKind: "collection" }))).toBe(false);
    expect(hasTracklistGaps(albumOf([1, 2, 3], { trackTotal: 12, albumKind: "collection" }))).toBe(false);
  });
});

describe("applyAlbumTriage", () => {
  const withArt = albumOf([1], { artUrl: "asset://cover.jpg", album: "Covered" });
  const withoutArt = albumOf([1], { album: "Bare" });
  const gapped = albumOf([1, 3], { album: "Gapped" });

  it("returns the list untouched when nothing is active", () => {
    const albums = [withArt, withoutArt];
    expect(applyAlbumTriage(albums, triage())).toBe(albums);
  });

  it("keeps only albums with no artwork", () => {
    const kept = applyAlbumTriage([withArt, withoutArt], triage({ missingArtwork: true }));
    expect(kept.map((a) => a.title)).toEqual(["Bare"]);
  });

  it("keeps only albums with a gapped tracklist", () => {
    const kept = applyAlbumTriage([withArt, gapped], triage({ tracklistGaps: true }));
    expect(kept.map((a) => a.title)).toEqual(["Gapped"]);
  });
});
