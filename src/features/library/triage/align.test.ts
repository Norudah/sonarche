import { describe, expect, it } from "vitest";

import type { Album } from "@/features/library/albums/albums";
import type { LibraryTrack } from "@/features/library/api";
import { type AlignPlan, summarizePlan, unidentifiedAlbumCount } from "@/features/library/triage/align";

function planWith(albums: Partial<AlignPlan["albums"][number]>[]): AlignPlan {
  return {
    scanned: albums.length,
    matched: albums.length,
    albums: albums.map((album, index) => ({
      album_id: index + 1,
      album: "Album",
      albumartist: "Artist",
      release_id: `rel-${index}`,
      release_group_id: null,
      release_title: "Release",
      release_artist: "Artist",
      release_year: 1997,
      cover_missing: false,
      items: [],
      album_fills: {},
      ...album,
    })),
  };
}

describe("summarizePlan", () => {
  it("counts item fills, album fills and missing covers together", () => {
    const plan = planWith([
      {
        items: [
          { item_id: 1, fills: { year: 1997, mb_trackid: "r1" } },
          { item_id: 2, fills: { mb_trackid: "r2" } },
        ],
        album_fills: { mb_albumid: "rel-0", year: 1997 },
        cover_missing: true,
      },
      { items: [], album_fills: { mb_albumid: "rel-1" }, cover_missing: false },
    ]);

    expect(summarizePlan(plan)).toEqual({ albums: 2, fields: 6, covers: 1 });
  });

  it("an empty plan summarizes to zeros", () => {
    expect(summarizePlan(planWith([]))).toEqual({ albums: 0, fields: 0, covers: 0 });
  });
});

function albumWith(mbTrackIds: (string | null)[]): Album {
  return {
    key: "a",
    title: "A",
    artist: "B",
    year: null,
    genres: [],
    tracks: mbTrackIds.map((mbTrackId, index) => ({ id: index, mbTrackId }) as LibraryTrack),
    length: 0,
    artUrl: null,
    formats: [],
  } as unknown as Album;
}

describe("unidentifiedAlbumCount", () => {
  it("counts only albums where no track has a MusicBrainz match", () => {
    const albums = [albumWith([null, null]), albumWith([null, "rec-1"]), albumWith(["rec-2"])];
    expect(unidentifiedAlbumCount(albums)).toBe(1);
  });
});
