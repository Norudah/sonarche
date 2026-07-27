import { describe, expect, it } from "vitest";

import type { ScanReport } from "@/features/import/api";
import { importPhase, type PhaseInput } from "@/features/import/phase";

const report: ScanReport = {
  playable: 10,
  unplayable: 0,
  unplayableByExtension: {},
  unplayableExamples: [],
  albumFolders: 2,
  bytes: 100,
  truncated: false,
};

function input(overrides: Partial<PhaseInput> = {}): PhaseInput {
  return {
    folder: "/Music",
    scanning: false,
    scanError: null,
    report: null,
    importing: false,
    importError: null,
    outcome: null,
    ...overrides,
  };
}

describe("importPhase", () => {
  it("is empty until a folder is chosen", () => {
    expect(importPhase(input({ folder: null }))).toEqual({ kind: "empty" });
  });

  it("scans as soon as a folder is chosen, before the mutation reports", () => {
    // The window between `setFolder` and the mutation flipping to pending is
    // one render, and a card that shows "no music here" in it would flicker a
    // wrong answer.
    expect(importPhase(input())).toEqual({ kind: "scanning" });
    expect(importPhase(input({ scanning: true }))).toEqual({ kind: "scanning" });
  });

  it("shows the summary once the scan lands", () => {
    expect(importPhase(input({ report }))).toEqual({ kind: "scanned", report });
  });

  it("reports a scan failure instead of an empty summary", () => {
    expect(importPhase(input({ scanError: "no such folder" }))).toEqual({
      kind: "scanFailed",
      message: "no such folder",
    });
  });

  it("lets the import take over from the summary", () => {
    expect(importPhase(input({ report, importing: true }))).toEqual({ kind: "importing", report });
  });

  /** The scan result is still in the cache when the import finishes; the
   * finished import is what the screen is about. */
  it("prefers the outcome over the scan it came from", () => {
    const outcome = { folders: 2 };

    expect(importPhase(input({ report, outcome }))).toEqual({ kind: "imported", outcome });
  });

  it("keeps the report when the import fails, so a retry needs no rescan", () => {
    expect(importPhase(input({ report, importError: "beet import failed" }))).toEqual({
      kind: "importFailed",
      message: "beet import failed",
      report,
    });
  });

  /** Nothing to count against and nothing to show: the import cannot have been
   * started from this state, so it must not be drawn as running. */
  it("does not claim to be importing without a report", () => {
    expect(importPhase(input({ importing: true }))).toEqual({ kind: "scanning" });
  });
});
