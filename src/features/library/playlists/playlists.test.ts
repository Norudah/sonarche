import { describe, expect, it } from "vitest";

import { track } from "@/features/library/testFixtures";
import type { Playlist } from "@/features/library/playlists/api";
import {
  orderedPlaylists,
  playlistCovers,
  playlistDuration,
  playlistNameTaken,
  playlistView,
  resolvePlaylistTracks,
  tracksById,
} from "@/features/library/playlists/playlists";

function playlist(id: number, name: string, kind: Playlist["kind"] = "user"): Playlist {
  return { id, name, kind, coverUrl: null, createdAt: 0, updatedAt: 0, itemIds: [] };
}

describe("resolvePlaylistTracks", () => {
  it("keeps the playlist's own order, not the library's", () => {
    const byId = tracksById([track({ id: 1 }), track({ id: 2 }), track({ id: 3 })]);
    const resolved = resolvePlaylistTracks([3, 1, 2], byId);
    expect(resolved.map((track) => track.id)).toEqual([3, 1, 2]);
  });

  it("drops ids the library no longer answers for", () => {
    const byId = tracksById([track({ id: 1 })]);
    expect(resolvePlaylistTracks([9, 1, 8], byId).map((track) => track.id)).toEqual([1]);
  });
});

describe("playlistCovers", () => {
  it("takes the first four distinct artworks in playing order", () => {
    const tracks = [
      track({ id: 1, artUrl: "a.jpg" }),
      track({ id: 2, artUrl: "a.jpg" }),
      track({ id: 3, artUrl: null }),
      track({ id: 4, artUrl: "b.jpg" }),
      track({ id: 5, artUrl: "c.jpg" }),
      track({ id: 6, artUrl: "d.jpg" }),
      track({ id: 7, artUrl: "e.jpg" }),
    ];
    expect(playlistCovers(tracks)).toEqual(["a.jpg", "b.jpg", "c.jpg", "d.jpg"]);
  });

  it("is empty when no member has artwork", () => {
    expect(playlistCovers([track({ id: 1, artUrl: null })])).toEqual([]);
  });
});

describe("playlistDuration", () => {
  it("sums the known durations and skips the unknown ones", () => {
    const tracks = [track({ id: 1, length: 120 }), track({ id: 2, length: null }), track({ id: 3, length: 30 })];
    expect(playlistDuration(tracks)).toBe(150);
  });
});

describe("playlistNameTaken", () => {
  it("collides case-insensitively after trimming", () => {
    const playlists = [playlist(1, "Détente")];
    expect(playlistNameTaken(playlists, " détente ")).toBe(true);
    expect(playlistNameTaken(playlists, "DÉTENTE")).toBe(true);
    expect(playlistNameTaken(playlists, "Sport")).toBe(false);
  });

  it("lets a playlist keep its own name through a rename", () => {
    const playlists = [playlist(1, "Détente")];
    expect(playlistNameTaken(playlists, "détente", 1)).toBe(false);
    expect(playlistNameTaken(playlists, "détente", 2)).toBe(true);
  });

  it("treats reserved labels as taken — the favorites' localized name", () => {
    expect(playlistNameTaken([], "favoris", undefined, ["Favoris"])).toBe(true);
    expect(playlistNameTaken([], "Sport", undefined, ["Favoris"])).toBe(false);
  });
});

describe("playlistView", () => {
  const tracks = [
    track({ id: 1, title: "Charlie", length: 100 }),
    track({ id: 2, title: "Alpha", length: 300 }),
    track({ id: 3, title: "Bravo", length: 200 }),
  ];

  it("without a sort, display order and stored positions coincide", () => {
    const view = playlistView(tracks, null);
    expect(view.map((row) => [row.track.id, row.position])).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
    ]);
  });

  it("sorted, each row keeps its stored position for the mutations", () => {
    const view = playlistView(tracks, { key: "title", dir: "asc" });
    expect(view.map((row) => [row.track.title, row.position])).toEqual([
      ["Alpha", 1],
      ["Bravo", 2],
      ["Charlie", 0],
    ]);
  });
});

describe("orderedPlaylists", () => {
  it("puts the favorites first and keeps the rest in incoming order", () => {
    const rows = [playlist(1, "Aube"), playlist(2, "Favorites", "favorites"), playlist(3, "Zénith")];
    expect(orderedPlaylists(rows).map((row) => row.id)).toEqual([2, 1, 3]);
  });
});
