import { describe, expect, it } from "vitest";

import type { LibraryTrack } from "@/features/library/api";
import {
  artistPropagations,
  buildAlbumUpdates,
  commonBaseline,
  commonGenreBucket,
  toAlbumDraft,
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

describe("commonGenreBucket", () => {
  it("is uniform when every track derives the same family", () => {
    expect(commonGenreBucket([track({ id: 1 }), track({ id: 2 })])).toEqual({ value: "Rock", mixed: false });
  });

  it("is mixed when the derived families disagree", () => {
    const cell = commonGenreBucket([track({ id: 1, genreBucket: "Rock" }), track({ id: 2, genreBucket: "Pop" })]);
    expect(cell.mixed).toBe(true);
  });
});

describe("artistPropagations", () => {
  // Album artist X everywhere; two tracks are really "X feat Y".
  const tracks = [track({ id: 1, artist: "X" }), track({ id: 2, artist: "X" }), track({ id: 3, artist: "X" })];

  function draftWithArtist(over: Record<number, string>) {
    const draft = toAlbumDraft(tracks, commonBaseline(tracks));
    for (const [id, artist] of Object.entries(over)) draft.rows[Number(id)].artist = artist;
    return draft;
  }

  it("offers nothing when no artist moved", () => {
    expect(artistPropagations(tracks, draftWithArtist({}))).toEqual([]);
  });

  it("offers the other tracks still at the old value as candidates", () => {
    const prop = artistPropagations(tracks, draftWithArtist({ 1: "X feat Y" }));
    expect(prop).toEqual([{ from: "X", to: "X feat Y", candidateIds: [2, 3] }]);
  });

  it("never lists the edited track itself as a candidate", () => {
    const prop = artistPropagations(tracks, draftWithArtist({ 2: "X feat Y" }));
    expect(prop[0].candidateIds).not.toContain(2);
    expect(prop[0].candidateIds).toEqual([1, 3]);
  });

  it("drops a candidate the user has already changed too", () => {
    // Both 1 and 2 renamed to the same value: neither is a candidate for the other.
    const prop = artistPropagations(tracks, draftWithArtist({ 1: "X feat Y", 2: "X feat Y" }));
    expect(prop).toEqual([{ from: "X", to: "X feat Y", candidateIds: [3] }]);
  });

  it("does not propagate from an empty original artist", () => {
    const bare = [track({ id: 1, artist: "" }), track({ id: 2, artist: "" })];
    const draft = toAlbumDraft(bare, commonBaseline(bare));
    draft.rows[1].artist = "New";
    expect(artistPropagations(bare, draft)).toEqual([]);
  });
});
