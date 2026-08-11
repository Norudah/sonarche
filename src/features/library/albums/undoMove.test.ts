import { describe, expect, it } from "vitest";

import { groupAlbums } from "@/features/library/albums/albums";
import { buildMoveUndo } from "@/features/library/albums/undoMove";
import { track } from "@/features/library/testFixtures";

describe("buildMoveUndo", () => {
  it("aims at a surviving source row rather than recreating a twin", () => {
    const snapshot = [
      track({ id: 10, album: "Kid A", albumArtist: "Radiohead", albumId: 3, track: 4, trackTotal: 10 }),
    ];
    const shelf = groupAlbums([track({ id: 1, album: "Kid A", albumArtist: "Radiohead", albumId: 3 })]);

    const plan = buildMoveUndo(snapshot, shelf);

    expect(plan?.specs).toEqual([{ itemIds: [10], targetAlbumId: 3 }]);
    expect(plan?.restore).toEqual([{ id: 10, fields: { track: "4", tracktotal: "10" } }]);
  });

  it("recreates a record the move emptied away", () => {
    const snapshot = [
      track({ id: 10, album: "Kid A", albumArtist: "Radiohead", albumId: 3, track: 1, trackTotal: 2 }),
      track({ id: 11, album: "Kid A", albumArtist: "Radiohead", albumId: 3, track: 2, trackTotal: 2 }),
    ];

    const plan = buildMoveUndo(snapshot, []);

    expect(plan?.specs).toEqual([{ itemIds: [10, 11], newAlbum: { album: "Kid A", albumartist: "Radiohead" } }]);
  });

  it("splits by source record and carries a collection's kind back", () => {
    const snapshot = [
      track({ id: 10, album: "Kid A", albumArtist: "Radiohead", albumId: 3 }),
      track({ id: 11, album: "Mes préférés", albumArtist: "Moi", albumId: 5, albumKind: "collection" }),
    ];

    const plan = buildMoveUndo(snapshot, []);

    expect(plan?.specs).toHaveLength(2);
    expect(plan?.specs[1]).toEqual({
      itemIds: [11],
      newAlbum: { album: "Mes préférés", albumartist: "Moi" },
      kind: "collection",
    });
  });

  it("clears a position the source never had", () => {
    const snapshot = [track({ id: 10, album: "Kid A", albumArtist: "Radiohead", track: null, trackTotal: null })];

    const plan = buildMoveUndo(snapshot, []);

    // Empty string is the update path's "unset", so a renumbered arrival goes
    // back to having no position at all.
    expect(plan?.restore).toEqual([{ id: 10, fields: { track: "", tracktotal: "" } }]);
  });

  it("refuses when a track had no record to go back to", () => {
    expect(buildMoveUndo([track({ id: 10, album: "" })], [])).toBeNull();
    expect(buildMoveUndo([], [])).toBeNull();
  });
});
