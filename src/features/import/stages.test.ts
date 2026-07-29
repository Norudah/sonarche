import { describe, expect, it } from "vitest";

import type { ScanReport } from "@/features/import/api";
import { importRail } from "@/features/import/stages";

const report: ScanReport = {
  playable: 40,
  unplayable: 0,
  unplayableByExtension: {},
  unplayableExamples: [],
  albumFolders: 10,
  bytes: 1000,
  truncated: false,
};

describe("importRail", () => {
  it("leaves every stage empty before a folder is chosen", () => {
    const rail = importRail({ kind: "empty" }, null);
    expect(rail.fills).toEqual([0, 0, 0]);
    expect(rail.activeIndex).toBeNull();
  });

  it("holds the scan stage at zero while it works, so the playhead sweeps it", () => {
    const rail = importRail({ kind: "scanning" }, null);
    expect(rail.fills).toEqual([0, 0, 0]);
    expect(rail.activeIndex).toBe(0);
  });

  it("stops on the stage that failed", () => {
    expect(importRail({ kind: "scanFailed", message: "nope" }, null)).toMatchObject({
      failedIndex: 0,
      tone: "danger",
    });
    expect(importRail({ kind: "importFailed", message: "nope", report }, null)).toMatchObject({
      fills: [1, 0, 0],
      failedIndex: 1,
      tone: "danger",
    });
  });

  it("closes the scan and waits once the folder is read", () => {
    const rail = importRail({ kind: "scanned", report }, null);
    expect(rail.fills).toEqual([1, 0, 0]);
    expect(rail.activeIndex).toBeNull();
    expect(rail.stage).toBeNull();
  });

  it("counts the copy against the folders the scan found", () => {
    const rail = importRail({ kind: "importing", report }, { stage: "copying", folders: 4, folder: "/Music/Album" });
    expect(rail.fills).toEqual([1, 0.4, 0]);
    expect(rail.activeIndex).toBe(1);
    expect(rail.stage).toBe("copy");
  });

  it("never lets the copy overshoot its segment", () => {
    // beets groups by what it finds in the files, so it can announce more steps
    // than the walk counted.
    const rail = importRail({ kind: "importing", report }, { stage: "copying", folders: 14, folder: null });
    expect(rail.fills[1]).toBe(1);
  });

  it("restarts the count on the cover pass, which measures something else", () => {
    const rail = importRail({ kind: "importing", report }, { stage: "covers", done: 1, total: 4 });
    expect(rail.fills).toEqual([1, 1, 0.25]);
    expect(rail.activeIndex).toBe(2);
  });

  it("fills every stage in the success tone once the import lands", () => {
    const outcome = { folders: 10, renditions: 0, recap: null };
    expect(importRail({ kind: "imported", outcome, report }, null)).toMatchObject({
      fills: [1, 1, 1],
      tone: "success",
      activeIndex: null,
    });
  });
});
