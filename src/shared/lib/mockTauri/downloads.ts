/** Download jobs: the queue, its history and the fake progress. */

import type { Handler } from "./types";
import { isEmpty, now, thumb } from "./fixtures";
import { emitMockEvent } from "./events";
import { mockImports } from "./imports";

function job(over: Record<string, unknown>) {
  return {
    id: Math.random().toString(36).slice(2),
    url: "https://youtube.com/watch?v=x",
    kind: "single",
    status: "queued",
    failedStep: null,
    error: null,
    title: null,
    artist: null,
    thumbnail: null,
    duration: null,
    report: null,
    tracks: [],
    downloadAttempts: 1,
    forcedAlbum: null as { title: string; artist: string | null; albumId?: number | null } | null,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

function albumTrack(over: Record<string, unknown>) {
  return {
    index: 1,
    videoId: "x",
    url: "https://youtube.com/watch?v=x",
    title: null,
    duration: null,
    status: "pending",
    error: null,
    stagedPath: null,
    itemId: null,
    report: null,
    duplicateOf: null,
    downloadAttempts: 0,
    ...over,
  };
}

// `provisional`: tags guessed from the video and sibling release.
const trackReport = (item_id: number | null, mb_matched: boolean, provisional = false) => ({
  item_id,
  mb_matched,
  provisional,
  source: mb_matched ? "MusicBrainz" : null,
  fields: {
    title: mb_matched || provisional,
    artist: mb_matched || provisional,
    album: mb_matched || provisional,
    year: mb_matched || provisional,
    track: mb_matched,
    genre: false,
  },
  cover: mb_matched || provisional,
  cover_source: mb_matched ? "Cover Art Archive" : null,
});

const jobs = [
  job({
    kind: "album",
    status: "downloading",
    url: "https://youtube.com/playlist?list=OLAK5uy_mock",
    title: "Hotline Miami 2: Wrong Number OST",
    thumbnail: thumb("#f0a", "#60c"),
    artist: "Various Artists",
    createdAt: now - 500,
    // Album 1 (Skillet's "Awake"): makes the delete guard reachable.
    forcedAlbum: { title: "Awake", artist: "Skillet", albumId: 1 },
    tracks: [
      albumTrack({
        index: 1,
        videoId: "a1",
        title: "Intro (Blizzard)",
        duration: 154,
        status: "done",
        // The first Hotline Miami OST item below.
        itemId: 200,
        downloadAttempts: 2,
        report: trackReport(200, true),
      }),
      albumTrack({
        index: 2,
        videoId: "a2",
        title: "Hollywood Heights",
        duration: 231,
        status: "imported",
        itemId: 201,
        downloadAttempts: 1,
        report: trackReport(201, false),
      }),
      albumTrack({ index: 3, videoId: "a3", title: "Java", duration: 197, status: "downloading", downloadAttempts: 2 }),
      albumTrack({
        index: 4,
        videoId: "a4",
        title: "Untitled (Deleted Video)",
        status: "failed",
        error: "yt-dlp: video unavailable",
        downloadAttempts: 3,
      }),
      albumTrack({ index: 5, videoId: "a5", title: "Rust", duration: 243 }),
    ],
  }),
  job({
    status: "downloading",
    title: "Nothing Else Matters",
    artist: "Metallica",
    duration: 386,
    thumbnail: thumb("#0bd", "#07a"),
    createdAt: now - 1000,
  }),
  job({ status: "queued", createdAt: now - 2000 }),
  job({ status: "importing", title: "Knock Knock", artist: "Scattle", duration: 213, createdAt: now - 3000 }),
  job({
    status: "enriching",
    title: "Nothing Else Matters",
    artist: "Metallica",
    duration: 386,
    createdAt: now - 3500,
  }),
  job({
    status: "done",
    title: "Monster",
    artist: "Skillet",
    duration: 178,
    thumbnail: thumb("#fb0", "#e40"),
    createdAt: now - 4000,
    report: {
      item_id: 2,
      mb_matched: true,
      source: "MusicBrainz",
      fields: { title: true, artist: true, album: true, year: true, track: true, genre: false },
      cover: true,
      cover_source: "Cover Art Archive",
    },
  }),
  job({
    status: "done",
    title: "Commander's Theme",
    artist: "The Algorithm",
    duration: 201,
    createdAt: now - 5000,
    report: {
      item_id: 5,
      mb_matched: false,
      provisional: true,
      source: null,
      fields: { title: true, artist: true, album: false, year: false, track: false, genre: false },
      cover: false,
      cover_source: null,
    },
  }),
  job({
    kind: "album",
    status: "done",
    url: "https://youtube.com/playlist?list=OLAK5uy_done",
    title: "Awake",
    artist: "Skillet",
    thumbnail: thumb("#2c8", "#083"),
    // Dead playlist slots: shows the "album may be incomplete" notice.
    unavailable: 2,
    createdAt: now - 5500,
    tracks: [
      albumTrack({
        index: 1,
        videoId: "b1",
        title: "Hero",
        duration: 187,
        status: "done",
        itemId: 2,
        report: trackReport(2, true),
      }),
      albumTrack({
        index: 2,
        videoId: "b2",
        title: "Monster",
        duration: 178,
        status: "done",
        itemId: 9,
        report: trackReport(9, false, true),
      }),
      // Duplicate dropped by enrich (same recording as #1).
      albumTrack({
        index: 3,
        videoId: "b3",
        title: "Hero (Official Video)",
        duration: 187,
        status: "done",
        itemId: 11,
        duplicateOf: 2,
      }),
    ],
  }),
  // One video pulled at the source: `done` with the loss reported in amber.
  job({
    kind: "album",
    status: "done",
    error: "1 of 4 tracks failed",
    url: "https://youtube.com/playlist?list=OLAK5uy_partial",
    title: "Cars (Original Soundtrack)",
    artist: "Various Artists",
    thumbnail: thumb("#e11", "#711"),
    createdAt: now - 5800,
    tracks: [
      albumTrack({ index: 1, videoId: "d1", title: "Real Gone", duration: 213, status: "done", itemId: 202 }),
      albumTrack({ index: 2, videoId: "d2", title: "Route 66", duration: 165, status: "done", itemId: 201 }),
      albumTrack({
        index: 3,
        videoId: "d3",
        title: "Life Is a Highway",
        status: "failed",
        error: "yt-dlp: video unavailable (copyright claim)",
        downloadAttempts: 3,
      }),
      albumTrack({ index: 4, videoId: "d4", title: "Sh-Boom", duration: 158, status: "done", itemId: 200 }),
    ],
  }),
  // Cancelled mid-download: retryable, resume markers kept.
  job({
    kind: "album",
    status: "cancelled",
    url: "https://youtube.com/playlist?list=OLAK5uy_stopped",
    title: "Random Access Memories",
    artist: "Daft Punk",
    thumbnail: thumb("#888", "#334"),
    createdAt: now - 5900,
    tracks: [
      albumTrack({
        index: 1,
        videoId: "c1",
        title: "Give Life Back to Music",
        duration: 275,
        status: "downloaded",
        stagedPath: "/tmp/1.m4a",
      }),
      albumTrack({ index: 2, videoId: "c2", title: "The Game of Love", duration: 322 }),
      albumTrack({ index: 3, videoId: "c3", title: "Giorgio by Moroder", duration: 544 }),
    ],
  }),
  job({
    status: "failed",
    failedStep: "download",
    error: "yt-dlp: video unavailable",
    downloadAttempts: 3,
    createdAt: now - 6000,
  }),
  job({
    status: "failed",
    failedStep: "import",
    title: "Some Track",
    artist: "Someone",
    error: "beet import failed (exit 1)",
    createdAt: now - 7000,
  }),
];

/** Fake yt-dlp progress, so the activity rail moves. */
export function tickDownloadProgress() {
  let percent = 0;
  window.setInterval(() => {
    percent = (percent + 7) % 104;
    emitMockEvent("sidecar:event", { event: "download_progress", data: { percent: Math.min(percent, 100) } });
  }, 700);
}

export const handlers: Record<string, Handler> = {
  list_jobs_page: (payload) => {
    const all = isEmpty ? [] : jobs;
    const offset = Number(payload?.offset ?? 0);
    const limit = Number(payload?.limit ?? 25);
    const terminal = new Set(["done", "failed", "cancelled"]);
    return {
      jobs: all.slice(offset, offset + limit),
      total: all.length,
      terminalTotal: all.filter((job) => terminal.has(String(job.status))).length,
    };
  },
  // Mirrors `JobsState::target_albums`.
  download_target_albums: () => {
    const terminal = new Set(["done", "failed", "cancelled"]);
    return (isEmpty ? [] : jobs)
      .filter((job) => !terminal.has(String(job.status)))
      .map((job) => job.forcedAlbum?.albumId)
      .filter((id): id is number => id != null);
  },
  // Must return a job with an `id`, or React renders a keyless row.
  enqueue_download: (payload) => {
    const queued = job({
      url: String(payload?.url ?? ""),
      kind: String(payload?.kind ?? "single"),
      category: (payload?.category as string | null) ?? null,
      forcedAlbum: (payload?.forcedAlbum as unknown) ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    jobs.unshift(queued);
    return queued;
  },
  // Terminal jobs and all imports; running jobs stay.
  clear_job_history: () => {
    for (let i = jobs.length - 1; i >= 0; i--) {
      const status = (jobs[i] as { status?: string }).status;
      if (status === "done" || status === "failed" || status === "cancelled") jobs.splice(i, 1);
    }
    mockImports.length = 0;
    return [...jobs];
  },
  retry_job: (payload) => {
    const target = jobs.find((j) => j.id === payload?.id);
    if (!target) return {};
    Object.assign(target, { status: "queued", error: null, failedStep: null });
    return target;
  },
  preview_download_undo: (payload) => {
    const target = jobs.find((j) => j.id === payload?.id) as { tracks?: { itemId?: number | null }[] } | undefined;
    const count = target?.tracks?.filter((t) => t.itemId != null).length || 1;
    return { tracks: count, albumsRemoved: 1, albumsKept: 0, playlistEntries: 2 };
  },
  undo_download: (payload) => {
    const target = jobs.find((j) => j.id === payload?.id) as
      { undoneAt?: number; tracks?: { itemId?: number | null }[] } | undefined;
    if (!target) return {};
    target.undoneAt = Date.now();
    const count = target.tracks?.filter((t) => t.itemId != null).length || 1;
    return { removed: count, foreign: 0, playlistEntries: 2 };
  },
  change_job_destination: (payload) => {
    const target = jobs.find((j) => j.id === payload?.id);
    if (!target) return {};
    Object.assign(target, { forcedAlbum: payload?.forcedAlbum ?? null, updatedAt: Date.now() });
    return target;
  },
  cancel_job: (payload) => {
    const target = jobs.find((j) => j.id === payload?.id);
    if (!target) return {};
    Object.assign(target, { status: "cancelled", error: null, failedStep: null });
    for (const track of (target as { tracks: { status: string }[] }).tracks) {
      if (track.status === "downloading") track.status = "pending";
    }
    return target;
  },
  list_jobs: () => (isEmpty ? [] : jobs),
};
