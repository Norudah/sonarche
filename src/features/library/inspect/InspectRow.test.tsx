// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InspectRow } from "@/features/library/inspect/InspectRow";
import { track } from "@/features/library/testFixtures";

afterEach(cleanup);

// Keys, not sentences: these cases are about which reason a cell gives, and the
// genre it names — never about the wording, which lives in the locales.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}(${Object.values(options).join(",")})` : key,
    i18n: { language: "fr" },
  }),
}));

// A row reads the player only to know whether it is the one playing.
vi.mock("@/shared/player/PlayerContext", () => ({ usePlayer: () => ({ current: null }) }));

function rowOf(over: Parameters<typeof track>[0], flags: Parameters<typeof InspectRow>[0]["flags"]) {
  render(
    <table>
      <tbody>
        <InspectRow track={track(over)} index={0} flags={flags} onPlay={() => {}} onEdit={() => {}} />
      </tbody>
    </table>,
  );
}

/** By its content, and for the empty case by the reason it gives — half the
 * columns of a bare fixture read as the same em-dash placeholder. */
const cellOf = (text: string) => screen.getByText(text).closest("td");

/**
 * The two verdicts the genre column carries are opposites, and showing them the
 * same way is what made a filled cell read as an empty one.
 */
describe("the genre column", () => {
  it("fills the cell only when the genre is actually missing", () => {
    rowOf({ genre: null }, ["genreMissing"]);

    const cell = cellOf("albums.attention.genreMissing");
    expect(cell?.className).toContain("bg-warning-soft");
    expect(cell?.textContent).toContain("metadata.emptyValue");
  });

  /** Nothing is missing here: the value is fine, our tree just has no room for
   * it. An amber fill would say the opposite. */
  it("leaves an off-tree genre unlit, and says why it is marked", () => {
    rowOf({ genre: "Psycho" }, ["genreOffTree"]);

    const cell = cellOf("Psycho");
    expect(cell?.className).not.toContain("bg-warning-soft");
    expect(cell?.textContent).toContain("inspect.offTree(Psycho)");
  });

  it("says nothing at all about a genre the tree knows", () => {
    rowOf({ genre: "Synthpop", genreBucket: "Electronic" }, []);

    const cell = cellOf("Synthpop");
    expect(cell?.className).not.toContain("bg-warning-soft");
    expect(cell?.textContent).toBe("Synthpop");
  });
});

/** The column beside it, which is what the off-tree remark is *about*. */
describe("the family column", () => {
  it("names the family the tree resolved", () => {
    rowOf({ genre: "Synthpop", genreBucket: "Electronic" }, []);
    expect(cellOf("Electronic")).not.toBeNull();
  });

  it("shows where an off-tree genre actually lands", () => {
    rowOf({ genre: "Psycho" }, ["genreOffTree"]);
    expect(cellOf("genres.other")).not.toBeNull();
  });

  /** No genre, no family: the hole is one column over, and naming it twice
   * would read as two problems. */
  it("stays empty when there is no genre to place", () => {
    rowOf({ genre: null }, ["genreMissing"]);
    expect(screen.queryByText("genres.none")).toBeNull();
  });
});
