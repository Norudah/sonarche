// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { LibraryTrack } from "@/features/library/api";
import { useAlbumDraft } from "@/features/library/albums/inspect/useAlbumDraft";

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

const album = [track({ id: 1, track: 1 }), track({ id: 2, track: 2, title: "Hero" })];

describe("useAlbumDraft", () => {
  it("writes the shared year onto every row", () => {
    const { result } = renderHook(() => useAlbumDraft(album));
    act(() => result.current.setCommon("year", "2010"));
    expect(result.current.draft.rows[1].year).toBe("2010");
    expect(result.current.draft.rows[2].year).toBe("2010");
    expect(result.current.view.values.year).toBe("2010");
    expect(result.current.summary.fields).toBeGreaterThan(0);
  });

  it("reset drops every pending edit", () => {
    const { result } = renderHook(() => useAlbumDraft(album));
    act(() => result.current.setRow(1, "title", "Monsters"));
    act(() => result.current.reset());
    expect(result.current.summary.fields).toBe(0);
  });

  it("re-seeds from refetched tracks while nothing is pending", () => {
    const { result, rerender } = renderHook(({ tracks }) => useAlbumDraft(tracks), {
      initialProps: { tracks: album },
    });
    rerender({ tracks: [track({ id: 1, track: 1, year: 2011 }), album[1]] });
    expect(result.current.draft.rows[1].year).toBe("2011");
  });

  it("does not mistake a refetch's new values for edits", () => {
    const { result, rerender } = renderHook(({ tracks }) => useAlbumDraft(tracks), {
      initialProps: { tracks: album },
    });
    // e.g. a re-match rewrote the tags while the inspector was open.
    rerender({ tracks: [track({ id: 1, track: 1, title: "Monster (Remastered)" }), album[1]] });
    expect(result.current.summary.fields).toBe(0);
  });

  it("keeps a pending draft over a refetch", () => {
    const { result, rerender } = renderHook(({ tracks }) => useAlbumDraft(tracks), {
      initialProps: { tracks: album },
    });
    act(() => result.current.setRow(1, "title", "Monsters"));
    rerender({ tracks: [track({ id: 1, track: 1, year: 2011 }), album[1]] });
    expect(result.current.draft.rows[1].title).toBe("Monsters");
  });
});
