import { describe, expect, it } from "vitest";

import type { LibraryTrack } from "@/features/library/api";
import {
  buildAlbumUpdates,
  changeSummary,
  commonBaseline,
  commonOrigins,
  distinctCommonCount,
  draftRowCell,
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
    albumId: 1,
    artUrl: null,
    artPath: null,
    bonusSource: null,
    mbTrackId: null,
    suspectMatch: false,
    provisionalCover: false,
    category: null,
    soundtrack: false,
    albumKind: null,
    accepted: [],
    albumAccepted: [],
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
      rows?: Record<number, { title?: string; track?: string; genre?: string; year?: string }>;
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
    const { base, draft } = draftFrom({ common: { albumartist: "Various Artists" } });
    const updates = buildAlbumUpdates(tracks, base, draft);
    expect(updates).toHaveLength(3);
    expect(updates.every((u) => u.fields.albumartist === "Various Artists")).toBe(true);
  });

  // Regression: `draft.common.genre` is only the mount-time seed — the UI fans
  // a common-genre edit out to the rows. Diffing the seed manufactured a
  // phantom change right after a save (the baseline had moved, the seed had
  // not), and re-saving that phantom wiped the album's genres.
  it("never reads the genre off the common draft — the rows are the genre", () => {
    const { base, draft } = draftFrom({ common: { genre: "Metal" } });
    expect(buildAlbumUpdates(tracks, base, draft)).toEqual([]);
  });

  it("never reads the year off the common draft — the rows are the year", () => {
    const { base, draft } = draftFrom({ common: { year: "2015" } });
    expect(buildAlbumUpdates(tracks, base, draft)).toEqual([]);
  });

  it("survives a save moving the baseline under a stale common-genre seed", () => {
    // A mixed record: the draft's genre seed is "".
    const mixed = [track({ id: 1, genre: "Rock" }), track({ id: 2, genre: null })];
    const draft = toAlbumDraft(mixed, commonBaseline(mixed));
    // The user fans one genre out (what setCommon does: rows only) and saves.
    draft.rows[1].genre = "Video Game Music";
    draft.rows[2].genre = "Video Game Music";
    const saved = [track({ id: 1, genre: "Video Game Music" }), track({ id: 2, genre: "Video Game Music" })];
    // Post-refetch, nothing may still read as pending — and above all a
    // re-save must write nothing, not clear the genre it just wrote.
    expect(changeSummary(saved, commonBaseline(saved), draft)).toEqual({ fields: 0, tracks: 0 });
    expect(buildAlbumUpdates(saved, commonBaseline(saved), draft)).toEqual([]);
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
    const { base, draft } = draftFrom({
      common: { albumartist: "Skillet & Friends" },
      rows: { 1: { title: "New A" } },
    });
    const updates = buildAlbumUpdates(tracks, base, draft);
    expect(updates).toHaveLength(3);
    expect(updates.find((u) => u.id === 1)!.fields).toEqual({ albumartist: "Skillet & Friends", title: "New A" });
    expect(updates.find((u) => u.id === 3)!.fields).toEqual({ albumartist: "Skillet & Friends" });
  });

  it("leaves an untouched mixed field alone — no blanket wipe", () => {
    const mixed = [track({ id: 1, genre: "Rock" }), track({ id: 2, genre: "Metal" })];
    const base = commonBaseline(mixed);
    const draft = toAlbumDraft(mixed, base); // genre draft starts empty (mixed)
    expect(buildAlbumUpdates(mixed, base, draft)).toEqual([]);
  });

  it("unifies a mixed field to every track once it is given a value", () => {
    const mixed = [track({ id: 1, category: "Video Games" }), track({ id: 2, category: null })];
    const base = commonBaseline(mixed);
    const draft = toAlbumDraft(mixed, base);
    draft.common.grouping = "Video Games";
    const updates = buildAlbumUpdates(mixed, base, draft);
    expect(updates).toHaveLength(2);
    expect(updates.every((u) => u.fields.grouping === "Video Games")).toBe(true);
  });

  it("unifies a mixed year through a fan-out on the rows — what the common field does", () => {
    const mixed = [track({ id: 1, year: 2009 }), track({ id: 2, year: 2011 })];
    const base = commonBaseline(mixed);
    const draft = toAlbumDraft(mixed, base);
    draft.rows[1].year = "2010";
    draft.rows[2].year = "2010";
    const updates = buildAlbumUpdates(mixed, base, draft);
    expect(updates).toHaveLength(2);
    expect(updates.every((u) => u.fields.year === "2010")).toBe(true);
  });

  // Regression: the sidecar trims text and skips a non-numeric int, so these
  // "edits" survived their own save as phantom pending changes.
  it("ignores edits the sidecar would not store — whitespace, bad ints", () => {
    const { base, draft } = draftFrom({
      common: { album: " Awake " },
      rows: { 2: { title: "B ", track: "2x" } },
    });
    expect(buildAlbumUpdates(tracks, base, draft)).toEqual([]);
    expect(changeSummary(tracks, base, draft)).toEqual({ fields: 0, tracks: 0 });
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

  it("lets a row's genre edit stand out of a fan-out — one write per row", () => {
    // What the UI does on a common-genre edit: write every row, then let one
    // row be corrected on its own.
    const { base, draft } = draftFrom({
      rows: { 1: { genre: "Metal" }, 2: { genre: "Orchestral" }, 3: { genre: "Metal" } },
    });
    const updates = buildAlbumUpdates(tracks, base, draft);
    expect(updates.find((u) => u.id === 2)!.fields.genre).toBe("Orchestral");
    expect(updates.find((u) => u.id === 1)!.fields.genre).toBe("Metal");
  });
});

describe("rowOrigins", () => {
  it("reports only the cells that moved, each with the value it left", () => {
    const live = track({ id: 1, title: "Monster", artist: "Skillet", genre: "Rock", track: 1, year: 2009 });
    const row = { track: "1", title: "Monster (live)", artist: "Skillet", year: "2009", genre: "Post-Rock" };

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
    draft.common.albumartist = "Various Artists";

    // One edit by the user; three files rewritten.
    expect(changeSummary(tracks, baseline, draft)).toEqual({ fields: 1, tracks: 3 });
  });

  it("counts a genre fan-out (written on every row) as one edit", () => {
    const draft = toAlbumDraft(tracks, baseline);
    for (const id of [1, 2, 3]) draft.rows[id].genre = "Post-Rock";

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

describe("draftRowCell", () => {
  it("reads the shared genre off the rows", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 })];
    const draft = toAlbumDraft(tracks, commonBaseline(tracks));

    expect(draftRowCell(tracks, draft, "genre")).toEqual({ value: "Rock", mixed: false, distinct: 1 });
  });

  it("goes mixed the moment one row moves, and counts the values in play", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 }), track({ id: 3 })];
    const draft = toAlbumDraft(tracks, commonBaseline(tracks));
    draft.rows[1].genre = "Post-Rock";

    expect(draftRowCell(tracks, draft, "genre")).toEqual({ value: "", mixed: true, distinct: 2 });
  });

  it("follows a fan-out back to a single value", () => {
    const tracks = [track({ id: 1, genre: "Rock" }), track({ id: 2, genre: "Metal" })];
    const draft = toAlbumDraft(tracks, commonBaseline(tracks));
    draft.rows[1].genre = "Post-Rock";
    draft.rows[2].genre = "Post-Rock";

    expect(draftRowCell(tracks, draft, "genre")).toEqual({ value: "Post-Rock", mixed: false, distinct: 1 });
  });

  it("reads the shared year off the rows, in the string form the inputs edit", () => {
    const tracks = [track({ id: 1, year: 2009 }), track({ id: 2, year: 2009 })];
    const draft = toAlbumDraft(tracks, commonBaseline(tracks));

    expect(draftRowCell(tracks, draft, "year")).toEqual({ value: "2009", mixed: false, distinct: 1 });
  });

  it("reads a year the sidecar would skip as the stored value — no phantom mix", () => {
    const tracks = [track({ id: 1, year: 2009 }), track({ id: 2, year: 2009 })];
    const draft = toAlbumDraft(tracks, commonBaseline(tracks));
    draft.rows[1].year = "20x9";

    expect(draftRowCell(tracks, draft, "year")).toEqual({ value: "2009", mixed: false, distinct: 1 });
  });
});

describe("commonOrigins", () => {
  it("judges the genre on the rows' shared reading, not the common seed", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 })];
    const baseline = commonBaseline(tracks);
    const draft = toAlbumDraft(tracks, baseline);
    draft.rows[1].genre = "Post-Rock";
    draft.rows[2].genre = "Post-Rock";

    expect(commonOrigins(tracks, baseline, draft)).toEqual({ genre: "Rock" });
  });

  it("marks a moved uniform field with the value it left, and nothing else", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 })];
    const baseline = commonBaseline(tracks);
    const draft = toAlbumDraft(tracks, baseline);
    draft.common.album = "Awake (Deluxe)";

    expect(commonOrigins(tracks, baseline, draft)).toEqual({ album: "Awake" });
  });

  it("judges the year on the rows' shared reading, like the genre", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 })];
    const baseline = commonBaseline(tracks);
    const draft = toAlbumDraft(tracks, baseline);
    draft.rows[1].year = "2010";
    draft.rows[2].year = "2010";

    expect(commonOrigins(tracks, baseline, draft)).toEqual({ year: "2009" });
  });

  it("shows no mark for an edit the save would not write", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 })];
    const baseline = commonBaseline(tracks);
    const draft = toAlbumDraft(tracks, baseline);
    draft.common.album = " Awake ";
    // A non-numeric year the sidecar would skip — typed on a row, where the
    // year now lives.
    draft.rows[1].year = "20x9";

    expect(commonOrigins(tracks, baseline, draft)).toEqual({});
  });
});

describe("distinctCommonCount", () => {
  it("counts the values a field holds, not the tracks holding them", () => {
    const tracks = [track({ id: 1, year: 2009 }), track({ id: 2, year: 2009 }), track({ id: 3, year: 2011 })];

    expect(distinctCommonCount(tracks, "year")).toBe(2);
  });
});
