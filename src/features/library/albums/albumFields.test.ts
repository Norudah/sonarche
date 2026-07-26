import { describe, expect, it } from "vitest";

import type { LibraryTrack } from "@/features/library/api";
import {
  buildAlbumUpdates,
  changeSummary,
  commonBaseline,
  distinctCommonCount,
  draftGenreCell,
  rowOrigins,
  toAlbumDraft,
  trackRowValues,
} from "@/features/library/albums/albumFields";

function track(over: Partial<LibraryTrack> = {}): LibraryTrack {
  return {
    id: 1,
    title: "Monster",
    artist: "Skillet",
    album: "Awake",
    albumArtist: "Skillet",
    year: 2009,
    genre: "Rock",
    genreBucket: "Rock",
    track: 1,
    trackTotal: 12,
    length: 178,
    bitrate: 256000,
    format: "AAC",
    path: "/music/monster.m4a",
    audioUrl: "asset://music/monster.m4a",
    artUrl: null,
    artPath: null,
    bonusSource: null,
    mbTrackId: null,
    suspectMatch: false,
    category: null,
    soundtrack: false,
    ...over,
  };
}

describe("commonBaseline", () => {
  it("marks a field the tracks agree on as uniform, carrying the value", () => {
    const base = commonBaseline([track({ id: 1 }), track({ id: 2 })]);
    expect(base.albumartist).toEqual({ value: "Skillet", mixed: false });
    expect(base.genre).toEqual({ value: "Rock", mixed: false });
  });

  it("marks a field the tracks disagree on as mixed, with no value", () => {
    const base = commonBaseline([track({ id: 1, genre: "Rock" }), track({ id: 2, genre: "Metal" })]);
    expect(base.genre).toEqual({ value: "", mixed: true });
  });

  it("treats a missing value as disagreement — a half-tagged genre reads mixed", () => {
    const base = commonBaseline([track({ id: 1, genre: "Rock" }), track({ id: 2, genre: null })]);
    expect(base.genre.mixed).toBe(true);
  });

  it("normalizes the year to the string form the input edits", () => {
    const base = commonBaseline([track({ year: 2009 })]);
    expect(base.year).toEqual({ value: "2009", mixed: false });
  });
});

describe("buildAlbumUpdates", () => {
  const tracks = [
    track({ id: 1, title: "A", track: 1 }),
    track({ id: 2, title: "B", track: 2 }),
    track({ id: 3, title: "C", track: 3 }),
  ];

  function draftFrom(
    over: {
      common?: Partial<Record<string, string>>;
      rows?: Record<number, { title?: string; track?: string; genre?: string }>;
    } = {},
  ) {
    const base = commonBaseline(tracks);
    const draft = toAlbumDraft(tracks, base);
    Object.assign(draft.common, over.common ?? {});
    for (const [id, patch] of Object.entries(over.rows ?? {})) {
      Object.assign(draft.rows[Number(id)], patch);
    }
    return { base, draft };
  }

  it("returns nothing when the draft matches the album", () => {
    const { base, draft } = draftFrom();
    expect(buildAlbumUpdates(tracks, base, draft)).toEqual([]);
  });

  it("fans a changed common field out to every track", () => {
    const { base, draft } = draftFrom({ common: { genre: "Metal" } });
    const updates = buildAlbumUpdates(tracks, base, draft);
    expect(updates).toHaveLength(3);
    expect(updates.every((u) => u.fields.genre === "Metal")).toBe(true);
  });

  it("applies a title edit to only its own track", () => {
    const { base, draft } = draftFrom({ rows: { 2: { title: "New B" } } });
    const updates = buildAlbumUpdates(tracks, base, draft);
    expect(updates).toEqual([{ id: 2, fields: { title: "New B" } }]);
  });

  it("carries a per-track number edit — reordering the record", () => {
    const { base, draft } = draftFrom({ rows: { 3: { track: "1" } } });
    const updates = buildAlbumUpdates(tracks, base, draft);
    expect(updates).toEqual([{ id: 3, fields: { track: "1" } }]);
  });

  it("combines a common change and a row change into one batch", () => {
    const { base, draft } = draftFrom({ common: { year: "2010" }, rows: { 1: { title: "New A" } } });
    const updates = buildAlbumUpdates(tracks, base, draft);
    expect(updates).toHaveLength(3);
    expect(updates.find((u) => u.id === 1)!.fields).toEqual({ year: "2010", title: "New A" });
    expect(updates.find((u) => u.id === 3)!.fields).toEqual({ year: "2010" });
  });

  it("leaves an untouched mixed field alone — no blanket wipe", () => {
    const mixed = [track({ id: 1, genre: "Rock" }), track({ id: 2, genre: "Metal" })];
    const base = commonBaseline(mixed);
    const draft = toAlbumDraft(mixed, base); // genre draft starts empty (mixed)
    expect(buildAlbumUpdates(mixed, base, draft)).toEqual([]);
  });

  it("unifies a mixed field to every track once it is given a value", () => {
    const mixed = [track({ id: 1, genre: "Rock" }), track({ id: 2, genre: "Metal" })];
    const base = commonBaseline(mixed);
    const draft = toAlbumDraft(mixed, base);
    draft.common.genre = "Industrial";
    const updates = buildAlbumUpdates(mixed, base, draft);
    expect(updates).toHaveLength(2);
    expect(updates.every((u) => u.fields.genre === "Industrial")).toBe(true);
  });

  it("fans the category out to every track on beets' grouping key", () => {
    const { base, draft } = draftFrom({ common: { grouping: "Video Games" } });
    const updates = buildAlbumUpdates(tracks, base, draft);
    expect(updates).toHaveLength(3);
    expect(updates.every((u) => u.fields.grouping === "Video Games")).toBe(true);
  });

  it("applies a row's genre edit to only its own track", () => {
    const { base, draft } = draftFrom({ rows: { 2: { genre: "Orchestral" } } });
    const updates = buildAlbumUpdates(tracks, base, draft);
    expect(updates).toEqual([{ id: 2, fields: { genre: "Orchestral" } }]);
  });

  it("lets a row's genre win over the common fan-out for that track", () => {
    const { base, draft } = draftFrom({ common: { genre: "Metal" }, rows: { 2: { genre: "Orchestral" } } });
    const updates = buildAlbumUpdates(tracks, base, draft);
    expect(updates.find((u) => u.id === 2)!.fields.genre).toBe("Orchestral");
    expect(updates.find((u) => u.id === 1)!.fields.genre).toBe("Metal");
  });
});

describe("rowOrigins", () => {
  it("reports only the cells that moved, each with the value it left", () => {
    const live = track({ id: 1, title: "Monster", artist: "Skillet", genre: "Rock", track: 1 });
    const row = { track: "1", title: "Monster (live)", artist: "Skillet", genre: "Post-Rock" };

    expect(rowOrigins(live, row)).toEqual({ title: "Monster", genre: "Rock" });
  });

  it("reports nothing for an untouched row", () => {
    const live = track({ id: 1 });
    expect(rowOrigins(live, trackRowValues(live))).toEqual({});
  });

  it("treats clearing a cell as a move, so the revert stays reachable", () => {
    const live = track({ id: 1, genre: "Rock" });
    expect(rowOrigins(live, { ...trackRowValues(live), genre: "" })).toEqual({ genre: "Rock" });
  });
});

describe("changeSummary", () => {
  const tracks = [track({ id: 1 }), track({ id: 2 }), track({ id: 3 })];
  const baseline = commonBaseline(tracks);

  it("counts a common field as one edit, however many tracks it writes to", () => {
    const draft = toAlbumDraft(tracks, baseline);
    draft.common.genre = "Post-Rock";

    // One edit by the user; three files rewritten.
    expect(changeSummary(tracks, baseline, draft)).toEqual({ fields: 1, tracks: 3 });
  });

  it("adds per-row cells to the count and names only the tracks actually touched", () => {
    const draft = toAlbumDraft(tracks, baseline);
    draft.rows[1].title = "Monster (live)";
    draft.rows[2].artist = "Skillet feat. Lacey";

    expect(changeSummary(tracks, baseline, draft)).toEqual({ fields: 2, tracks: 2 });
  });

  it("counts one tag once, however many rows carry it", () => {
    const draft = toAlbumDraft(tracks, baseline);
    draft.rows[1].title = "One";
    draft.rows[2].title = "Two";
    draft.rows[3].title = "Three";

    // Three files to rewrite, but the user changed one thing: the titles.
    expect(changeSummary(tracks, baseline, draft)).toEqual({ fields: 1, tracks: 3 });
  });

  it("does not double-count a genre reached from both the common field and a row", () => {
    const draft = toAlbumDraft(tracks, baseline);
    draft.common.genre = "Post-Rock";
    for (const id of [1, 2, 3]) draft.rows[id].genre = "Post-Rock";

    expect(changeSummary(tracks, baseline, draft)).toEqual({ fields: 1, tracks: 3 });
  });

  it("keeps the album artist and a row's artist apart — they are two tags", () => {
    const draft = toAlbumDraft(tracks, baseline);
    draft.common.albumartist = "Skillet & Friends";
    draft.rows[1].artist = "Skillet feat. Lacey";

    expect(changeSummary(tracks, baseline, draft)).toEqual({ fields: 2, tracks: 3 });
  });

  it("reports nothing on an untouched draft", () => {
    expect(changeSummary(tracks, baseline, toAlbumDraft(tracks, baseline))).toEqual({ fields: 0, tracks: 0 });
  });

  it("ignores a mixed field left empty — the save would not touch it either", () => {
    const mixed = [track({ id: 1, genre: "Rock" }), track({ id: 2, genre: "Metal" })];
    const mixedBaseline = commonBaseline(mixed);

    expect(changeSummary(mixed, mixedBaseline, toAlbumDraft(mixed, mixedBaseline))).toEqual({ fields: 0, tracks: 0 });
  });
});

describe("draftGenreCell", () => {
  it("reads the shared genre off the rows", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 })];
    const draft = toAlbumDraft(tracks, commonBaseline(tracks));

    expect(draftGenreCell(tracks, draft)).toEqual({ value: "Rock", mixed: false, distinct: 1 });
  });

  it("goes mixed the moment one row moves, and counts the values in play", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 }), track({ id: 3 })];
    const draft = toAlbumDraft(tracks, commonBaseline(tracks));
    draft.rows[1].genre = "Post-Rock";

    expect(draftGenreCell(tracks, draft)).toEqual({ value: "", mixed: true, distinct: 2 });
  });

  it("follows a fan-out back to a single value", () => {
    const tracks = [track({ id: 1, genre: "Rock" }), track({ id: 2, genre: "Metal" })];
    const draft = toAlbumDraft(tracks, commonBaseline(tracks));
    draft.rows[1].genre = "Post-Rock";
    draft.rows[2].genre = "Post-Rock";

    expect(draftGenreCell(tracks, draft)).toEqual({ value: "Post-Rock", mixed: false, distinct: 1 });
  });
});

describe("distinctCommonCount", () => {
  it("counts the values a field holds, not the tracks holding them", () => {
    const tracks = [track({ id: 1, year: 2009 }), track({ id: 2, year: 2009 }), track({ id: 3, year: 2011 })];

    expect(distinctCommonCount(tracks, "year")).toBe(2);
  });
});
