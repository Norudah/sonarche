import { describe, expect, it } from "vitest";

import { engineProgress } from "@/features/onboarding/engineStages";

const VENV = ["Python: /app/runtime/bin/python3 (3.13.1)", "Creating virtual environment..."];
const PIP = [
  ...VENV,
  "Installing dependencies from the bundled wheels...",
  "Collecting beets==2.12.0",
  "Collecting yt-dlp==2026.7.4",
];

describe("engineProgress", () => {
  it("shows nothing running before the install", () => {
    expect(engineProgress("idle", [])).toEqual({ cleared: 0, current: null, cargo: 0, live: null });
  });

  it("runs the first stage while the environment is created", () => {
    expect(engineProgress("installing", VENV)).toMatchObject({ cleared: 0, current: 0, cargo: 0 });
    expect(engineProgress("installing", []).live).toEqual({ kind: "venv" });
  });

  it("names the package pip is on during the second stage", () => {
    expect(engineProgress("installing", PIP)).toEqual({
      cleared: 1,
      current: 1,
      cargo: 2,
      live: { kind: "package", pkg: "yt-dlp" },
    });
  });

  it("loads one crate as soon as pip starts, and never more than three", () => {
    expect(engineProgress("installing", [...VENV, "Collecting beets==2.12.0"]).cargo).toBe(1);
    const many = ["a", "b", "c", "d", "e"].map((name) => `Collecting ${name}==1.0`);
    expect(engineProgress("installing", [...VENV, ...many]).cargo).toBe(3);
  });

  it("falls back to a generic line once pip installs the lot", () => {
    expect(engineProgress("installing", [...PIP, "Installing collected packages: beets, yt-dlp"]).live).toEqual({
      kind: "packages",
    });
  });

  // pip being done is not the end: the beets config is written after it.
  it("moves to the third stage once pip has finished", () => {
    expect(engineProgress("installing", [...PIP, "Successfully installed beets-2.12.0"])).toEqual({
      cleared: 2,
      current: 2,
      cargo: 3,
      live: { kind: "finalizing" },
    });
  });

  it("clears every stage and loads every crate when done", () => {
    expect(engineProgress("done", PIP)).toEqual({ cleared: 3, current: null, cargo: 4, live: null });
  });

  it("points the failure at the stage that was running", () => {
    expect(engineProgress("error", PIP)).toMatchObject({ cleared: 1, current: 1, live: null });
    expect(engineProgress("error", VENV)).toMatchObject({ cleared: 0, current: 0 });
  });

  it("leaves at least one crate on the quay after a failure", () => {
    expect(engineProgress("error", [...PIP, "Successfully installed beets-2.12.0"]).cargo).toBe(2);
  });
});
