import type { AlbumTrackJob, DownloadJob, MetadataReport, MetadataReportFields } from "@/features/download/api";

/** Fixture factories for the queue's pure modules (pipeline, tags, attempts,
 * library presence). Test-only: nothing in `src/` imports this file, and the
 * `.ts` name keeps it out of the `*.test.ts` run. */

export function report(over: Partial<MetadataReport> = {}): MetadataReport {
  const fields: MetadataReportFields = {
    title: true,
    artist: true,
    album: true,
    year: true,
    track: true,
    genre: false,
    ...over.fields,
  };
  return {
    itemId: 1,
    mbMatched: true,
    provisional: false,
    source: "MusicBrainz",
    cover: true,
    coverSource: "Cover Art Archive",
    ...over,
    fields,
  };
}

export function albumTrack(over: Partial<AlbumTrackJob> = {}): AlbumTrackJob {
  return {
    index: 1,
    videoId: "v",
    url: "https://youtube.com/watch?v=v",
    title: "A track",
    duration: 180,
    status: "pending",
    error: null,
    itemId: null,
    report: null,
    duplicateOf: null,
    downloadAttempts: 0,
    ...over,
  };
}

export function job(over: Partial<DownloadJob> = {}): DownloadJob {
  return {
    id: "job-1",
    url: "https://youtube.com/watch?v=v",
    kind: "single",
    status: "queued",
    failedStep: null,
    error: null,
    title: "A title",
    artist: "An artist",
    thumbnail: null,
    duration: 180,
    report: null,
    tracks: [],
    downloadAttempts: 0,
    category: null,
    forcedAlbum: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}
