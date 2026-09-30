import { describe, expect, it } from "vitest";

import { NO_TRIAGE } from "@/features/library/tracks/triage";
import { restrictTriage } from "@/features/library/tracks/useTrackFilter";

const active = { ...NO_TRIAGE, family: "Rock", genre: "Grunge", category: "Film", decade: 1990, missingYear: true };

describe("restrictTriage", () => {
  it("keeps every axis the surface owns", () => {
    expect(restrictTriage(active, ["family", "genre", "category"])).toEqual(active);
  });

  it("drops the axes a scoped page answers itself", () => {
    // A genre page's own `?genre=` must not be read again as a filter.
    expect(restrictTriage(active, ["category"])).toEqual({ ...active, family: null, genre: null });
    expect(restrictTriage(active, ["family"])).toEqual({ ...active, genre: null, category: null });
  });

  it("never touches the panel's axes, which every scope carries", () => {
    const restricted = restrictTriage(active, []);
    expect(restricted.decade).toBe(1990);
    expect(restricted.missingYear).toBe(true);
    expect(restricted).toEqual({ ...active, family: null, genre: null, category: null });
  });
});
