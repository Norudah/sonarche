import { describe, expect, it } from "vitest";

import { mapJob, type WireJob } from "@/features/download/api";

/** A job as the backend stores it — snake_case inside reports, camelCase
 * outside, and several fields absent on rows written by older versions. */
function wireJob(over: Partial<WireJob> = {}): WireJob {
  return {
    id: "job-1",
    url: "https://youtube.com/watch?v=v",
    kind: "single",
    status: "done",
    failedStep: null,
    error: null,
    title: "Monster",
    artist: "Skillet",
    thumbnail: null,
    duration: 178,
    report: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

describe("mapJob", () => {
  it("renames the report's snake_case wire fields", () => {
    const mapped = mapJob(
      wireJob({
        report: {
          item_id: 42,
          mb_matched: true,
          provisional: false,
          source: "MusicBrainz",
          fields: { title: true, artist: true, album: true, year: true, track: true, genre: false },
          cover: true,
          cover_source: "Cover Art Archive",
        },
      }),
    );
    expect(mapped.report).toMatchObject({
      itemId: 42,
      mbMatched: true,
      coverSource: "Cover Art Archive",
    });
  });

  it("leaves a job with no report alone", () => {
    expect(mapJob(wireJob({ report: null })).report).toBeNull();
  });

  it("reads a legacy report with no provisional flag as not guessed", () => {
    // Those jobs predate provisional tagging, so nothing was ever guessed.
    const legacy = mapJob(
      wireJob({
        report: {
          item_id: 1,
          mb_matched: true,
          source: null,
          fields: { title: true, artist: true, album: true, year: true, track: true, genre: false },
          cover: false,
          cover_source: null,
        },
      }),
    );
    expect(legacy.report?.provisional).toBe(false);
  });

  it("gives a single an empty track list rather than undefined", () => {
    // The queue maps over `tracks` unconditionally; undefined would throw.
    expect(mapJob(wireJob({ tracks: undefined })).tracks).toEqual([]);
  });

  it("defaults the attempt counters absent from older rows to zero", () => {
    const mapped = mapJob(
      wireJob({
        kind: "album",
        downloadAttempts: undefined,
        tracks: [
          {
            index: 1,
            videoId: "v",
            url: "https://youtube.com/watch?v=v",
            title: "A track",
            duration: 180,
            status: "done",
            error: null,
            stagedPath: null,
            itemId: 5,
            report: null,
          },
        ],
      }),
    );
    expect(mapped.downloadAttempts).toBe(0);
    expect(mapped.tracks[0]).toMatchObject({ downloadAttempts: 0, duplicateOf: null });
  });
});
