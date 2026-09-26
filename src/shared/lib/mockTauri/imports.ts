/** Folder imports, their archive and the align pass. */

import type { Handler } from "./types";
import { now } from "./fixtures";
import { emitMockEvent } from "./events";

/** Long enough to exercise middle truncation. */
export const MOCK_IMPORT_FOLDER = "/Volumes/Backup/archive/2011/music/rips/FLAC";

/** A few thousand tracks with some undecodable files. `?emptyImport` gives a
 * folder without music. */
function mockScan(path: string): unknown {
  if (new URLSearchParams(window.location.search).has("emptyImport")) {
    return {
      playable: 0,
      unplayable: 0,
      unplayableByExtension: {},
      unplayableExamples: [],
      albumFolders: 0,
      largestFolder: 0,
      bytes: 0,
      truncated: false,
    };
  }

  return {
    playable: 4287,
    unplayable: 25,
    unplayableByExtension: { wma: 19, opus: 6 },
    unplayableExamples: [`${path}/Old Rips/track01.wma`, `${path}/Podcasts/ep-114.opus`],
    albumFolders: MOCK_IMPORT_FOLDERS.length,
    // Past `CROWDED_FOLDER`, so the grouping suggestion shows.
    largestFolder: 214,
    // Shows the re-import notice, cancelled flavour.
    previouslyImported: { folder: path, finishedAt: now - 86_400_000, cancelled: true },
    bytes: 31_400_000_000,
    truncated: false,
  };
}

const MOCK_IMPORT_FOLDERS = [
  "Aphex Twin/Selected Ambient Works 85-92",
  "Boards of Canada/Music Has the Right to Children",
  "Burial/Untrue",
  "Fever Ray/Fever Ray",
  "Portishead/Dummy",
  "The Avalanches/Since I Left You",
];

function mockScanCounts() {
  const report = mockScan(MOCK_IMPORT_FOLDER) as Record<string, unknown>;
  return {
    playable: report.playable,
    unplayable: report.unplayable,
    unplayableByExtension: report.unplayableByExtension,
    bytes: report.bytes,
    albumFolders: MOCK_IMPORT_FOLDERS.length,
  };
}

/** Two archived runs, one failed, so History shows both verdicts. */
export const mockImports: unknown[] = [
  {
    id: "import-seed-2",
    folder: "/Volumes/Backup/archive/2019/Soundtracks",
    status: "done",
    grouping: "folder",
    category: "Video Games",
    error: null,
    scan: { playable: 312, unplayable: 0, unplayableByExtension: {}, bytes: 2_100_000_000, albumFolders: 14 },
    folders: 14,
    renditions: 9,
    recap: {
      tracks: 312,
      albums: 14,
      withoutYear: 0,
      withoutGenre: 0,
      offTree: 0,
      albumsWithoutArt: 0,
      albumsWithGaps: 0,
    },
    finishedAt: Date.now() - 86_400_000 * 3,
  },
  {
    id: "import-seed-1",
    folder: "/Volumes/Elements/Musique (sauvegarde)",
    status: "failed",
    error: "beet import failed (exit 1): [Errno 13] Permission denied: '/Volumes/Elements/Musique (sauvegarde)'",
    scan: {
      playable: 1904,
      unplayable: 61,
      unplayableByExtension: { wma: 61 },
      bytes: 12_800_000_000,
      albumFolders: 97,
    },
    folders: 0,
    renditions: 0,
    recap: null,
    finishedAt: Date.now() - 86_400_000 * 11,
  },
];

/** Armed by `cancel_library_import`, consumed by the next copy tick. */
let mockImportCancelRequested = false;

/** An import that takes visible time. `?failImport` stops it partway; the
 * stop button works, one album late like the real watchdog. */
async function mockLibraryImport(folder: string, options: Record<string, unknown>): Promise<unknown> {
  const failAt = new URLSearchParams(window.location.search).has("failImport") ? 3 : Infinity;
  mockImportCancelRequested = false;

  let copied = 0;
  for (const [index, album] of MOCK_IMPORT_FOLDERS.entries()) {
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    if (mockImportCancelRequested) break;
    if (index + 1 === failAt) {
      throw `beet import failed (exit 1): could not read ${folder}/${album}`;
    }
    copied = index + 1;
    emitMockEvent("sidecar:event", {
      event: "library_import_progress",
      data: { folders: copied, folder: `${folder}/${album}` },
    });
  }
  const cancelled = mockImportCancelRequested;

  // The cover pass restarts the bar; it also runs after a cancel.
  for (let done = 1; done <= copied; done += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    emitMockEvent("sidecar:event", {
      event: "library_covers_progress",
      data: { done, total: copied, renditions: Math.ceil(done / 2) },
    });
  }

  const record = {
    id: `import-${Date.now()}`,
    folder,
    status: cancelled ? ("cancelled" as const) : ("done" as const),
    error: null,
    scan: mockScanCounts(),
    folders: copied,
    renditions: Math.ceil(copied / 2),
    grouping: (options?.grouping as string) ?? "folder",
    category: (options?.category as string | null) ?? null,
    recap:
      copied === 0
        ? null
        : {
            tracks: Math.round((118 * copied) / MOCK_IMPORT_FOLDERS.length),
            albums: copied,
            withoutYear: 12,
            withoutGenre: 41,
            offTree: 3,
            albumsWithoutArt: 2,
            albumsWithGaps: 1,
          },
    finishedAt: Date.now(),
  };
  mockImports.unshift(record);

  return { folders: record.folders, renditions: record.renditions, recap: record.recap, cancelled };
}

/** Read off the run's recap, since the mock has no library to count. */
function mockUndoPreview(id: string): unknown {
  const record = mockImports.find((row) => (row as { id: string }).id === id) as
    { recap: { tracks: number; albums: number } | null } | undefined;
  const tracks = record?.recap?.tracks ?? 0;
  const albums = record?.recap?.albums ?? 0;
  return {
    tracks,
    // Keeps one album, to show the "album only loses tracks" sentence.
    albumsRemoved: Math.max(0, albums - 1),
    albumsKept: albums > 0 ? 1 : 0,
    playlistEntries: tracks > 0 ? 3 : 0,
  };
}

function mockUndo(id: string): unknown {
  const record = mockImports.find((row) => (row as { id: string }).id === id) as
    { undoneAt?: number; recap: { tracks: number } | null } | undefined;
  if (!record) return { removed: 0, foreign: 0, playlistEntries: 0 };
  record.undoneAt = Date.now();
  return { removed: record.recap?.tracks ?? 0, foreign: 0, playlistEntries: 3 };
}

/** The align pass at preview pace, returning a small plan over fixture albums. */
async function mockAlignScan(): Promise<unknown> {
  const scanned = ["Iberia", "Hotline Miami OST", "Discovery", "Random Access Memories"];
  for (const [index, album] of scanned.entries()) {
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    emitMockEvent("sidecar:event", {
      event: "library_align_progress",
      data: { stage: "scan", done: index + 1, total: scanned.length, album },
    });
  }
  const albums = [
    {
      album_id: 1,
      album: "Hotline Miami OST",
      albumartist: "Various Artists",
      release_id: "mb-hlm",
      release_group_id: "rg-hlm",
      release_title: "Hotline Miami: Official Soundtrack",
      release_artist: "Various Artists",
      release_year: 2012,
      cover_missing: false,
      items: [
        { item_id: 200, fills: { mb_trackid: "rec-hydrogen", mb_albumid: "mb-hlm" }, genres: ["Synthwave"] },
        { item_id: 201, fills: { mb_trackid: "rec-roller", mb_albumid: "mb-hlm", year: 2012 }, genres: [] },
      ],
      album_fills: { mb_albumid: "mb-hlm", mb_releasegroupid: "rg-hlm" },
    },
    {
      album_id: 2,
      album: "Discovery",
      albumartist: "Daft Punk",
      release_id: "mb-discovery",
      release_group_id: "rg-discovery",
      release_title: "Discovery",
      release_artist: "Daft Punk",
      release_year: 2001,
      cover_missing: true,
      items: [{ item_id: 100, fills: { mb_trackid: "rec-omt", mb_albumid: "mb-discovery", year: 2001 } }],
      album_fills: { mb_albumid: "mb-discovery", year: 2001 },
    },
  ];
  return { scanned: scanned.length, matched: albums.length, albums };
}

async function mockAlignApply(payload?: Record<string, unknown>): Promise<unknown> {
  const plan = (payload?.plan ?? {}) as { albums?: { album: string; items: unknown[]; cover_missing: boolean }[] };
  const albums = plan.albums ?? [];
  for (const [index, album] of albums.entries()) {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    emitMockEvent("sidecar:event", {
      event: "library_align_progress",
      data: { stage: "apply", done: index + 1, total: albums.length, album: album.album },
    });
  }
  return {
    albums_updated: albums.length,
    items_updated: albums.reduce((sum, album) => sum + album.items.length, 0),
    covers_fetched: albums.filter((album) => album.cover_missing).length,
    genres_filled: albums.reduce((sum, album) => sum + album.items.length, 0),
  };
}

export const handlers: Record<string, Handler> = {
  scan_import_folder: (payload) => mockScan(String(payload?.path ?? "")),
  start_library_import: (payload) =>
    mockLibraryImport(String(payload?.folder ?? ""), payload as Record<string, unknown>),
  cancel_library_import: () => {
    mockImportCancelRequested = true;
    return null;
  },
  list_imports: () => [...mockImports],
  preview_import_undo: (payload) => mockUndoPreview(String(payload?.id ?? "")),
  undo_import: (payload) => mockUndo(String(payload?.id ?? "")),
  library_align_scan: () => mockAlignScan(),
  library_align_apply: (payload) => mockAlignApply(payload),
};
