import { Heart, ListMusic } from "lucide-react";
import { describe, expect, it } from "vitest";

import type { Playlist } from "@/features/library/playlists/api";
import { markerValue, resolveMarker } from "@/features/library/playlists/marker";

function playlist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    id: 1,
    name: "Route de nuit",
    kind: "user",
    coverUrl: null,
    coverPath: null,
    marker: null,
    createdAt: 0,
    updatedAt: 0,
    itemIds: [],
    ...overrides,
  };
}

describe("resolveMarker", () => {
  it("falls back to the playlist glyph, and to the filled heart for the favorites", () => {
    expect(resolveMarker(playlist())).toMatchObject({ mode: "icon", icon: ListMusic });
    expect(resolveMarker(playlist({ kind: "favorites" }))).toMatchObject({
      mode: "icon",
      icon: Heart,
      filled: true,
    });
  });

  it("keeps the favorites on the heart whatever the row stored", () => {
    // Nothing offers to redress that list any more, so a marker set before the
    // picker was withheld would otherwise be unremovable.
    expect(resolveMarker(playlist({ kind: "favorites", marker: "color:teal" }))).toMatchObject({ icon: Heart });
    expect(resolveMarker(playlist({ kind: "favorites", marker: "cover", coverUrl: "tile.jpg" }))).toMatchObject({
      icon: Heart,
    });
  });

  it("reads the three stored shapes", () => {
    expect(resolveMarker(playlist({ marker: "icon:flame" }))).toMatchObject({ mode: "icon", key: "flame" });
    expect(resolveMarker(playlist({ marker: "color:teal" }))).toMatchObject({ mode: "color", key: "teal" });
    expect(resolveMarker(playlist({ marker: "cover", coverUrl: "tile.jpg" }))).toEqual({
      mode: "cover",
      url: "tile.jpg",
    });
  });

  it("falls back rather than leaving a hole in the navigation", () => {
    // An icon this build does not ship (an older front, a newer store) …
    expect(resolveMarker(playlist({ marker: "icon:not-shipped" }))).toMatchObject({ icon: ListMusic });
    expect(resolveMarker(playlist({ marker: "color:puce" }))).toMatchObject({ icon: ListMusic });
    expect(resolveMarker(playlist({ marker: "nonsense" }))).toMatchObject({ icon: ListMusic });
    // … and a thumbnail whose image has since been removed.
    expect(resolveMarker(playlist({ marker: "cover", coverUrl: null }))).toMatchObject({ icon: ListMusic });
  });
});

describe("markerValue", () => {
  it("round-trips every mode back through resolveMarker", () => {
    for (const stored of ["icon:flame", "color:teal", "cover"]) {
      const row = playlist({ marker: stored, coverUrl: "tile.jpg" });
      expect(markerValue(resolveMarker(row))).toBe(stored);
    }
  });
});
