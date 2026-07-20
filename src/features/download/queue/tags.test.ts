import { describe, expect, it } from "vitest";

import { formatTags, jobTags, tagTone, trackTags } from "@/features/download/queue/tags";
import { albumTrack, job, report } from "@/features/download/testFixtures";

describe("trackTags", () => {
  it("has nothing to say without a report", () => {
    expect(trackTags("single", null)).toBeNull();
  });

  it("counts album and track number for an album, not for a single", () => {
    const full = report({
      mbMatched: true,
      cover: true,
      fields: { title: true, artist: true, album: true, year: true, track: true, genre: true },
    });
    expect(trackTags("single", full)).toMatchObject({ filled: 5, total: 5 });
    expect(trackTags("album", full)).toMatchObject({ filled: 7, total: 7 });
  });

  it("counts zero when the file was neither matched nor guessed", () => {
    // The report's field flags describe what a match would have written; with
    // no match and no guess the file is genuinely blank.
    const blank = report({ mbMatched: false, provisional: false });
    expect(trackTags("single", blank)).toMatchObject({ filled: 0, total: 5 });
  });

  it("counts guessed tags — they really are on the file — and flags them", () => {
    const guessed = report({
      mbMatched: false,
      provisional: true,
      cover: false,
      fields: { title: true, artist: true, album: true, year: true, track: false, genre: false },
    });
    expect(trackTags("single", guessed)).toMatchObject({
      filled: 3, // title, artist, year — cover and genre are missing
      total: 5,
      provisional: true,
    });
  });
});

describe("jobTags", () => {
  it("averages an album over its tracks", () => {
    const album = job({
      kind: "album",
      tracks: [
        albumTrack({ index: 1, report: report({ cover: true }) }), // 6/7
        albumTrack({ index: 2, report: report({ cover: false }) }), // 5/7
      ],
    });
    // (6/7 + 5/7) / 2 = 0.7857… → 79 %
    expect(jobTags(album)).toMatchObject({ kind: "percent", value: 79 });
  });

  it("excludes dropped duplicates from the average even when they carry a report", () => {
    const album = job({
      kind: "album",
      tracks: [
        albumTrack({ index: 1, report: report() }), // 6/7
        // Dropped as a content duplicate. It normally has no report at all, but
        // one left over from before the drop must not drag the album down: the
        // exclusion is on `duplicateOf`, not on the absence of a report.
        albumTrack({ index: 2, report: report({ mbMatched: false }), duplicateOf: 4 }),
      ],
    });
    expect(jobTags(album)).toMatchObject({ value: 86 }); // 6/7 alone
  });

  it("still ignores a duplicate that has no report", () => {
    const album = job({
      kind: "album",
      tracks: [
        albumTrack({ index: 1, report: report() }),
        albumTrack({ index: 2, report: null, duplicateOf: 4 }),
      ],
    });
    expect(jobTags(album)).toMatchObject({ value: 86 });
  });

  it("marks the whole album provisional as soon as one track was guessed", () => {
    const album = job({
      kind: "album",
      tracks: [
        albumTrack({ index: 1, report: report({ mbMatched: true, provisional: false }) }),
        albumTrack({ index: 2, report: report({ mbMatched: false, provisional: true }) }),
      ],
    });
    expect(jobTags(album)).toMatchObject({ provisional: true });
  });

  it("has nothing to say for an album whose tracks have no reports yet", () => {
    const album = job({ kind: "album", tracks: [albumTrack({ report: null })] });
    expect(jobTags(album)).toBeNull();
  });

  it("falls back to the job's own report for a single", () => {
    expect(jobTags(job({ kind: "single", report: report() }))).toMatchObject({ kind: "ratio" });
  });
});

describe("tagTone", () => {
  it("stays amber on a complete but guessed set", () => {
    // The count is full, the content is not verified — never green.
    expect(tagTone({ kind: "ratio", filled: 5, total: 5, provisional: true })).toBe("warning");
    expect(tagTone({ kind: "percent", value: 100, provisional: true })).toBe("warning");
  });

  it("is green only on a verified full set", () => {
    expect(tagTone({ kind: "ratio", filled: 5, total: 5, provisional: false })).toBe("success");
    expect(tagTone({ kind: "percent", value: 100, provisional: false })).toBe("success");
  });

  it("is red on an empty set and amber in between", () => {
    expect(tagTone({ kind: "ratio", filled: 0, total: 5, provisional: false })).toBe("danger");
    expect(tagTone({ kind: "ratio", filled: 3, total: 5, provisional: false })).toBe("warning");
    expect(tagTone({ kind: "percent", value: 0, provisional: false })).toBe("danger");
  });
});

describe("formatTags", () => {
  it("prints a ratio for a track and a percentage for an album", () => {
    expect(formatTags({ kind: "ratio", filled: 3, total: 5, provisional: false })).toBe("3/5");
    expect(formatTags({ kind: "percent", value: 79, provisional: false })).toBe("79 %");
  });
});
