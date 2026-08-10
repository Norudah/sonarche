import { describe, expect, it } from "vitest";

import { commonBaseline, toAlbumDraft, type AlbumDraft } from "@/features/library/albums/albumFields";
import { fillArtistOffer, offerKey, pendingOffers, renumbered } from "@/features/library/albums/albumOffers";
import type { LibraryTrack } from "@/features/library/api";

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
    ...over,
  };
}

function draftOf(tracks: LibraryTrack[], edits: Record<number, Partial<AlbumDraft["rows"][number]>> = {}): AlbumDraft {
  const draft = toAlbumDraft(tracks, commonBaseline(tracks));
  for (const [id, patch] of Object.entries(edits)) {
    draft.rows[Number(id)] = { ...draft.rows[Number(id)], ...patch };
  }
  return draft;
}

const none = new Set<string>();

describe("pendingOffers", () => {
  it("offers the rows still carrying the old genre when one row moves", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 }), track({ id: 3, genre: "Metal" })];
    const offers = pendingOffers(tracks, draftOf(tracks, { 1: { genre: "Post-Rock" } }), none);

    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ kind: "genre", trackId: 1, from: "Rock", to: "Post-Rock" });
    // Track 2 still shows "Rock"; track 3 never did, and the edited row is out.
    expect(offers[0].candidateIds).toEqual([2]);
  });

  it("never offers a move nothing else could take", () => {
    const tracks = [track({ id: 1 }), track({ id: 2, genre: "Metal" })];
    expect(pendingOffers(tracks, draftOf(tracks, { 1: { genre: "Post-Rock" } }), none)).toEqual([]);
  });

  it("de-dupes two rows making the same move into one offer", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 }), track({ id: 3 })];
    const draft = draftOf(tracks, { 1: { genre: "Post-Rock" }, 2: { genre: "Post-Rock" } });
    const offers = pendingOffers(tracks, draft, none);

    expect(offers).toHaveLength(1);
    expect(offers[0].candidateIds).toEqual([3]);
  });

  it("keeps a dismissed move dismissed", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 })];
    const draft = draftOf(tracks, { 1: { genre: "Post-Rock" } });
    const dismissed = new Set([offerKey("genre", "Rock", "Post-Rock")]);

    expect(pendingOffers(tracks, draft, dismissed)).toEqual([]);
  });

  it("asks again once the value is re-typed, since the move is a different one", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 })];
    const draft = draftOf(tracks, { 1: { genre: "Shoegaze" } });
    const dismissed = new Set([offerKey("genre", "Rock", "Post-Rock")]);

    expect(pendingOffers(tracks, draft, dismissed)).toHaveLength(1);
  });

  it("raises genre and artist offers side by side — one no longer replaces the other", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 }), track({ id: 3 })];
    const draft = draftOf(tracks, { 1: { genre: "Post-Rock" }, 2: { artist: "Skillet feat. Lacey" } });
    const kinds = pendingOffers(tracks, draft, none).map((offer) => offer.kind);

    expect(kinds).toEqual(["genre", "artist"]);
  });

  it("pre-ticks every candidate of an artist rename", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 }), track({ id: 3 })];
    const [offer] = pendingOffers(tracks, draftOf(tracks, { 1: { artist: "Skillet feat. Lacey" } }), none);

    expect(offer.kind === "artist" && offer.preselectedIds).toEqual([2, 3]);
  });

  it("drops a candidate the user already moved elsewhere", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 }), track({ id: 3 })];
    const draft = draftOf(tracks, { 1: { genre: "Post-Rock" }, 2: { genre: "Ambient" } });
    const genre = pendingOffers(tracks, draft, none).find((offer) => offer.from === "Rock");

    expect(genre?.candidateIds).toEqual([3]);
  });

  it("ignores a cleared value — emptying a field is not a move to propagate", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 })];
    expect(pendingOffers(tracks, draftOf(tracks, { 1: { genre: "" } }), none)).toEqual([]);
  });
});

describe("fillArtistOffer", () => {
  it("pre-ticks only the tracks with no artist, so a featuring is never overwritten", () => {
    const tracks = [
      track({ id: 1, artist: "Skillet" }),
      track({ id: 2, artist: "" }),
      track({ id: 3, artist: "Skillet feat. Lacey" }),
    ];
    const offer = fillArtistOffer(tracks, draftOf(tracks), "Skillet");

    expect(offer?.candidateIds).toEqual([2, 3]);
    expect(offer?.preselectedIds).toEqual([2]);
  });

  it("has nothing to offer when every track already matches", () => {
    const tracks = [track({ id: 1 }), track({ id: 2 })];
    expect(fillArtistOffer(tracks, draftOf(tracks), "Skillet")).toBeNull();
  });

  it("has nothing to offer without an album artist to copy", () => {
    const tracks = [track({ id: 1, artist: "" })];
    expect(fillArtistOffer(tracks, draftOf(tracks), "   ")).toBeNull();
  });
});

describe("renumbered", () => {
  it("numbers the rows 1..N in displayed order, whatever they carried", () => {
    const tracks = [track({ id: 7, track: 4 }), track({ id: 9, track: null }), track({ id: 2, track: 4 })];
    expect(renumbered(tracks)).toEqual({ 7: "1", 9: "2", 2: "3" });
  });
});
