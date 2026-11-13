import { describe, expect, it } from "vitest";

import { installPhase, namedPackageCount } from "@/features/onboarding/installPhase";

describe("installPhase", () => {
  it("says nothing has started before the first line", () => {
    expect(installPhase([])).toEqual({ kind: "starting" });
  });

  it("reads the venv creation", () => {
    expect(installPhase(["Python: /opt/homebrew/bin/python3 (3.13.1)", "Creating virtual environment..."])).toEqual({
      kind: "venv",
    });
  });

  it("counts unpacking the bundled interpreter as building the environment", () => {
    expect(installPhase(["Unpacking the bundled Python..."])).toEqual({ kind: "venv" });
  });

  it("names the package being fetched, stripped of its pin", () => {
    expect(
      installPhase(["Creating virtual environment...", "Collecting beets==2.12.0 (from -r requirements.txt (line 1))"]),
    ).toEqual({ kind: "fetching", pkg: "beets" });
  });

  it("takes the last package, not the first", () => {
    expect(installPhase(["Collecting beets==2.12.0", "Collecting yt-dlp==2026.7.4"])).toEqual({
      kind: "fetching",
      pkg: "yt-dlp",
    });
  });

  it("reads a cached wheel's distribution name, not its file name", () => {
    expect(installPhase(["Using cached mutagen-1.47.0-py3-none-any.whl (194 kB)"])).toEqual({
      kind: "fetching",
      pkg: "mutagen",
    });
  });

  it("reads a bundled wheel given by path", () => {
    expect(installPhase(["Processing /app/wheels/yt_dlp-2026.10.26-py3-none-any.whl"])).toEqual({
      kind: "fetching",
      pkg: "yt_dlp",
    });
  });

  it("moves on to installing once pip stops collecting", () => {
    expect(installPhase(["Collecting beets==2.12.0", "Installing collected packages: beets, yt-dlp"])).toEqual({
      kind: "installing",
    });
  });

  // Regression: "Successfully installed" used to read as installing, so the
  // last stage (writing the beets config) never showed.
  it("separates pip finishing from the install itself", () => {
    expect(
      installPhase(["Installing collected packages: beets", "Successfully installed beets-2.12.0 yt-dlp-2026.7.4"]),
    ).toEqual({ kind: "finalizing" });
  });

  it("reports the end", () => {
    expect(installPhase(["Successfully installed beets-2.12.0", "Environment ready."])).toEqual({ kind: "done" });
  });

  it("ignores noise between meaningful lines", () => {
    expect(installPhase(["Collecting beets==2.12.0", "", "  |████████| 1.9 MB 12.1 MB/s"])).toEqual({
      kind: "fetching",
      pkg: "beets",
    });
  });
});

describe("namedPackageCount", () => {
  it("counts each package once across its collect and download lines", () => {
    expect(
      namedPackageCount([
        "Collecting beets==2.12.0",
        "Downloading beets-2.12.0-py3-none-any.whl (1.9 MB)",
        "Collecting yt-dlp==2026.7.4",
        "Processing /app/wheels/yt_dlp-2026.7.4-py3-none-any.whl",
        "Installing collected packages: beets, yt-dlp",
      ]),
    ).toBe(2);
  });

  it("is zero before pip names anything", () => {
    expect(namedPackageCount(["Creating virtual environment..."])).toBe(0);
  });
});
