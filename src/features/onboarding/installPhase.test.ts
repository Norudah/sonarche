import { describe, expect, it } from "vitest";

import { installPhase } from "@/features/onboarding/installPhase";

describe("installPhase", () => {
  it("says nothing has started before the first line", () => {
    expect(installPhase([])).toEqual({ kind: "starting" });
  });

  it("reads the venv creation", () => {
    expect(installPhase(["Python: /opt/homebrew/bin/python3 (3.13.1)", "Creating virtual environment..."])).toEqual({
      kind: "venv",
    });
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

  it("reads a cached wheel the same way as a downloaded one", () => {
    expect(installPhase(["Using cached mutagen-1.47.0-py3-none-any.whl (194 kB)"])).toEqual({
      kind: "fetching",
      pkg: "mutagen-1.47.0-py3-none-any.whl",
    });
  });

  it("moves on to installing once pip stops collecting", () => {
    expect(installPhase(["Collecting beets==2.12.0", "Installing collected packages: beets, yt-dlp"])).toEqual({
      kind: "installing",
    });
  });

  it("reports the end", () => {
    expect(installPhase(["Installing collected packages: beets", "Environment ready."])).toEqual({ kind: "done" });
  });

  it("ignores noise between meaningful lines", () => {
    expect(installPhase(["Collecting beets==2.12.0", "", "  |████████| 1.9 MB 12.1 MB/s"])).toEqual({
      kind: "fetching",
      pkg: "beets",
    });
  });
});
