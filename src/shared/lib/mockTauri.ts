/** Dev-only Tauri IPC stub so the UI can be previewed in a plain browser
 * (`vite dev` + `?mockTauri`). Never bundled in production builds. */

const now = Date.now();

/** 16:9 like a real video thumbnail. */
function thumb(from: string, to: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

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

const apiKeys = [{ name: "acoustid", configured: false }];

/** Keys saved this session, so `reveal_api_key` has something to return. */
const storedKeys = new Map<string, string>();
// API delays match the backend's fixed defaults.
const preferences = {
  lastfmFetchDelaySeconds: 1,
  acoustidLookupDelaySeconds: 1,
  downloadDelaySeconds: 3,
  audioFormat: "m4a",
};

const preferenceFields: Record<
  string,
  "lastfmFetchDelaySeconds" | "acoustidLookupDelaySeconds" | "downloadDelaySeconds"
> = {
  lastfm: "lastfmFetchDelaySeconds",
  acoustid: "acoustidLookupDelaySeconds",
  download: "downloadDelaySeconds",
};

const MOCK_RELEASE_BODY = `## [0.9.0](https://github.com/Norudah/sonarche/compare/sonarche-v0.8.0...sonarche-v0.9.0) (2026-08-12)

### Features

* **library:** let a cover be recropped in place ([1a2b3c4](https://github.com/Norudah/sonarche/commit/1a2b3c4d))
* **onboarding:** pick the language during setup ([5e6f7a8](https://github.com/Norudah/sonarche/commit/5e6f7a8b))
* **shell:** name the two modes on the lens toggle ([8607459](https://github.com/Norudah/sonarche/commit/86074590))

### Bug Fixes

* **ui:** mark every delete as destructive ([9b8c7d6](https://github.com/Norudah/sonarche/commit/9b8c7d6e))
* **shell:** keep the app's name on the Windows window ([f9d5943](https://github.com/Norudah/sonarche/commit/f9d59430))
`;

/** The one undecodable (Opus) fixture, so the unplayable state is clickable. */
const UNPLAYABLE_TITLE = "Wait";

/** Mirrors `src-tauri/src/audio_formats.rs`. */
function isPlayablePath(path: string): boolean {
  return /\.(mp3|flac|m4a|m4b|mp4|aac|ogg|oga|wav|wave|aiff|aif|aifc)$/i.test(path);
}

// Only one done job's item exists, so the "removed from library" state shows.
const libraryTracks = [
  {
    id: 2,
    title: "Monster",
    artist: "Skillet",
    album: "Awake",
    album_artist: "Skillet",
    year: 2009,
    genre: null,
    track: 2,
    track_total: 12,
    length: 178,
    bitrate: 256000,
    format: "AAC",
    path: "/Users/dev/Music/Sonarche/Music/Skillet/Monster.m4a",
    art_path: thumb("#334", "#112"),
    // Adopted bonus track.
    bonus_source: "Awake: Deluxe Edition",
    mb_trackid: "rec-monster",
    suspect_match: false,
    // Gives the category menu a second value (a single option hides it).
    category: "Music",
    soundtrack: false,
  },
  // [title, artist, album, genre, bucket, length, year, track, cover].
  // Buckets are what `sidecar/genre_tree.py` resolves; "Dance Pop" and
  // "Synthwave" are off-tree on purpose. Deliberately uneven: compilations,
  // missing covers, genres and years.
  ...(
    [
      ["Night Changes", "One Direction", "Four", "Teen Pop", "Pop", 226, 2014, 1, "#a78bfa|#7c3aed"],
      ["Steal My Girl", "One Direction", "Four", "Teen Pop", "Pop", 228, 2014, 2, "#a78bfa|#7c3aed"],
      ["Fireproof", "One Direction", "Four", null, null, 202, 2014, 3, "#a78bfa|#7c3aed"],
      ["One More Night", "Daft Punk", "Discovery", "French House", "Electronic", 238, 2001, 1, "#22d3ee|#0e7490"],
      ["Digital Love", "Daft Punk", "Discovery", "French House", "Electronic", 298, 2001, 2, "#22d3ee|#0e7490"],
      ["Harder Better Faster", "Daft Punk", "Discovery", "French House", "Electronic", 224, 2001, 3, "#22d3ee|#0e7490"],
      ["Get Lucky", "Daft Punk", "Random Access Memories", "Disco", "Electronic", 369, 2013, 8, "#1f2937|#111827"],
      ["Instant Crush", "Daft Punk", "Random Access Memories", "Disco", "Electronic", 337, 2013, 5, "#1f2937|#111827"],
      [
        "The Less I Know the Better",
        "Tame Impala",
        "Currents",
        "Psychedelic Pop",
        "Pop",
        216,
        2015,
        4,
        "#fb923c|#c2410c",
      ],
      ["Let It Happen", "Tame Impala", "Currents", "Psychedelic Pop", "Pop", 467, 2015, 1, "#fb923c|#c2410c"],
      ["Nights", "Frank Ocean", "Blonde", null, null, 307, 2016, 5, "#bef264|#84cc16"],
      ["Ivy", "Frank Ocean", "Blonde", null, null, 249, 2016, 3, "#bef264|#84cc16"],
      ["Weird Fishes / Arpeggi", "Radiohead", "In Rainbows", "Art Rock", "Rock", 318, 2007, 4, "#f472b6|#9333ea"],
      ["Nude", "Radiohead", "In Rainbows", "Art Rock", "Rock", 255, 2007, 3, "#f472b6|#9333ea"],
      ["Levitating", "Dua Lipa", "Future Nostalgia", "Dance Pop", null, 203, 2020, 4, "#6d28d9|#4c1d95"],
      ["Physical", "Dua Lipa", "Future Nostalgia", null, null, 194, 2020, 3, "#6d28d9|#4c1d95"],
      ["Come as You Are", "Nirvana", "Nevermind", "Grunge", "Rock", 219, 1991, 3, "#38bdf8|#0369a1"],
      ["Lithium", "Nirvana", "Nevermind", "Grunge", "Rock", 257, 1991, 5, "#38bdf8|#0369a1"],
      // No cover.
      ["Midnight City", "M83", "Hurry Up, We're Dreaming", "Synthwave", null, 243, 2011, 4, null],
      ["Wait", "M83", "Hurry Up, We're Dreaming", null, null, 322, 2011, 8, null],
    ] as const
  ).map(([title, artist, album, genre, bucket, length, year, trackNo, cover], index) => ({
    id: 100 + index,
    title,
    artist,
    album,
    album_artist: artist,
    year,
    genre,
    genre_bucket: bucket,
    track: trackNo,
    track_total: 12,
    length,
    bitrate: 256000,
    format: title === UNPLAYABLE_TITLE ? "Opus" : "AAC",
    path: `/Users/dev/Music/Sonarche/Music/${artist}/${title}.${title === UNPLAYABLE_TITLE ? "opus" : "m4a"}`,
    art_path: cover ? thumb(cover.split("|")[0], cover.split("|")[1]) : null,
    bonus_source: null,
    mb_trackid: null,
    suspect_match: false,
    category: null,
    soundtrack: false,
  })),

  // Compilation: track artists differ from the album artist.
  ...(
    [
      ["Hydrogen", "M|O|O|N", 1, 269],
      ["Roller Mobster", "Carpenter Brut", 2, 231],
      ["Knock Knock", "Scattle", 3, 213],
      // A guest appearance by an artist with records of their own.
      ["Midnight City (HM Edit)", "M83", 4, 241],
    ] as const
  ).map(([title, artist, trackNo, length], index) => ({
    id: 200 + index,
    title,
    artist,
    album: "Hotline Miami OST",
    album_artist: "Various Artists",
    year: 2012,
    genre: "Synthwave",
    // Off-tree: lands in Other.
    genre_bucket: null,
    track: trackNo,
    track_total: 3,
    length,
    bitrate: 256000,
    format: "AAC",
    path: `/Users/dev/Music/Sonarche/Music/Various Artists/${title}.m4a`,
    art_path: thumb("#f43f5e", "#7c2d12"),
    bonus_source: null,
    mb_trackid: null,
    suspect_match: false,
    // Forced album still on its video thumbnail.
    provisional_cover: true,
    category: "Video Games",
    soundtrack: true,
  })),

  // A cross-language suspect match and a duplicate recording.
  ...(
    [
      [300, "You Can’t Take Me", 1, true],
      [301, "You Can’t Take Me", 2, false],
    ] as const
  ).map(([id, title, trackNo, flagged]) => ({
    id,
    title,
    artist: "Bryan Adams",
    album: "Spirit: Stallion of the Cimarron",
    album_artist: "Bryan Adams",
    year: 2002,
    genre: "Art Rock",
    genre_bucket: "Rock",
    track: trackNo,
    track_total: 2,
    length: 265,
    bitrate: 256000,
    format: "AAC",
    path: `/Users/dev/Music/Sonarche/Music/Bryan Adams/${title}.m4a`,
    art_path: thumb("#d97706", "#78350f"),
    bonus_source: null,
    mb_trackid: "rec-yctm",
    suspect_match: flagged,
    // MusicBrainz soundtrack without a category: the pre-suggestion case.
    category: null,
    soundtrack: true,
  })),
];

/** `?tracks=10000` clones the seed to measure views at scale. Clones get a
 * generation suffix so albums don't collapse. */
function inflate<
  T extends { id: number; album: string; album_artist: string; mb_trackid: string | null; suspect_match: boolean },
>(seed: T[], total: number): T[] {
  if (total <= seed.length) return seed;
  return Array.from({ length: total }, (_, i) => {
    const source = seed[i % seed.length];
    const generation = Math.floor(i / seed.length);
    return generation === 0
      ? source
      : {
          ...source,
          id: 10_000 + i,
          album: `${source.album} (${generation})`,
          album_artist: `${source.album_artist} ${generation}`,
          // Otherwise the duplicates line would flood.
          mb_trackid: null,
          suspect_match: false,
        };
  });
}

/** beets album ids per (album artist, album). */
function withAlbumIds<T extends { album: string; album_artist: string }>(tracks: T[]): (T & { album_id: number })[] {
  const ids = new Map<string, number>();
  return tracks.map((track) => {
    const key = `${track.album_artist}␟${track.album}`;
    const id = ids.get(key) ?? ids.size + 1;
    ids.set(key, id);
    return { ...track, album_id: id };
  });
}

const requestedTracks = Number(new URLSearchParams(window.location.search).get("tracks") ?? 0);

/** `?empty`: every listing is empty (first launch). */
const isEmpty = new URLSearchParams(window.location.search).has("empty");

/** `?setup=python` (no interpreter) or `?setup=engine` (no venv); pair with
 * `?onboarding=1` to bypass the completion flag. */
const requestedSetup = new URLSearchParams(window.location.search).get("setup");

const env = {
  python: requestedSetup === "python" ? null : { path: "/opt/homebrew/bin/python3", version: "3.13.1" },
  venvOk: requestedSetup !== "python" && requestedSetup !== "engine",
  depsOk: requestedSetup !== "python" && requestedSetup !== "engine",
  // `?bundled`: the app ships its own interpreter, so the Python step is hidden.
  pythonBundled: new URLSearchParams(window.location.search).has("bundled"),
  libraryDir: "/Users/dev/Music/Sonarche",
};

/** `?returning`: the broken environment of an already-onboarded install. */
const isReturning = new URLSearchParams(window.location.search).has("returning");

const onboarding = { completed: requestedSetup == null || isReturning, acoustidConfigured: isReturning };

/** The lines `python_env.rs` and pip emit, at a watchable pace. */
const SETUP_SCRIPT = [
  "Python: /opt/homebrew/bin/python3 (3.13.1)",
  "Creating virtual environment...",
  "Installing dependencies (this can take a few minutes)...",
  "Collecting beets==2.12.0 (from -r requirements.txt (line 1))",
  "Downloading beets-2.12.0-py3-none-any.whl (1.9 MB)",
  "Collecting yt-dlp==2026.7.4 (from -r requirements.txt (line 2))",
  "Collecting mutagen==1.47.0 (from -r requirements.txt (line 3))",
  "Installing collected packages: mutagen, yt-dlp, beets",
  "Environment ready.",
];

function runMockSetup(): Promise<unknown> {
  return new Promise((resolve) => {
    let index = 0;
    const timer = window.setInterval(() => {
      emitMockEvent("setup:log", SETUP_SCRIPT[index]);
      index += 1;
      if (index >= SETUP_SCRIPT.length) {
        window.clearInterval(timer);
        env.venvOk = true;
        env.depsOk = true;
        resolve(env);
      }
    }, 900);
  });
}

/** Starts empty: the generated avatar is the default. */
const artistImages = new Map<string, string>();

/**
 * Mutated in place like the Rust store. Favorites always exists; the user
 * lists cover a long mixed list, a single-album list and a dead item id.
 */
interface MockPlaylist {
  id: number;
  name: string;
  kind: "user" | "favorites";
  cover_path: string | null;
  marker: string | null;
  created_at: number;
  updated_at: number;
  item_ids: number[];
}

const mockPlaylists: MockPlaylist[] = [
  {
    id: 100,
    name: "Favorites",
    kind: "favorites",
    cover_path: null,
    marker: null,
    created_at: now - 86_400_000 * 30,
    updated_at: now - 86_400_000,
    item_ids: isEmpty ? [] : [104, 112],
  },
  ...(isEmpty
    ? []
    : ([
        {
          id: 1,
          name: "Sessions de nuit",
          kind: "user",
          cover_path: null,
          // One of each sidebar face: icon, colour, default.
          marker: "icon:moon",
          created_at: now - 86_400_000 * 9,
          updated_at: now - 3_600_000,
          item_ids: [110, 106, 112, 116, 100, 2, 118],
        },
        {
          id: 2,
          name: "French touch",
          kind: "user",
          cover_path: null,
          marker: "color:rose",
          created_at: now - 86_400_000 * 4,
          updated_at: now - 86_400_000,
          item_ids: [103, 104, 105],
        },
        {
          id: 4,
          name: "Sport",
          kind: "user",
          cover_path: thumb("#f97316", "#7c2d12"),
          marker: "cover",
          created_at: now - 86_400_000 * 6,
          updated_at: now - 5_400_000,
          item_ids: [107, 108],
        },
        {
          id: 3,
          name: "Rétro console",
          kind: "user",
          cover_path: null,
          marker: null,
          created_at: now - 86_400_000 * 2,
          updated_at: now - 7_200_000,
          item_ids: [200, 201, 9999, 203],
        },
      ] as MockPlaylist[])),
];
let nextPlaylistId = 5;

function mockPlaylist(id: unknown): MockPlaylist {
  const playlist = mockPlaylists.find((row) => row.id === Number(id));
  if (!playlist) throw "invalid input: playlist not found";
  return playlist;
}

// Placements, plus each genre's original bucket so reset can restore it.
const mockGenreOverrides = new Map<string, string>();
const mockBaseBuckets = new Map<string, string | null>();

const responses: Record<string, unknown> = {
  list_jobs: isEmpty ? [] : jobs,
  remux_library: { scanned: 0, fragmented: 0, remuxed: 0, failed: [] },
  list_library: { tracks: isEmpty ? [] : withAlbumIds(inflate(libraryTracks, requestedTracks)) },
  // One seed track is `.wma`, so the unplayable badge is reachable.
  playable_extensions: ["mp3", "flac", "m4a", "m4b", "mp4", "aac", "ogg", "oga", "wav", "wave", "aiff", "aif", "aifc"],
  list_api_keys: apiKeys,
  get_preferences: preferences,
};

let callbackId = 0;

/** Event listeners by name. Tauri's `listen()` registers a callback id that
 * the backend calls; the player depends on these pushed events. */
const listeners = new Map<string, Set<(payload: unknown) => void>>();
const callbacks = new Map<number, (message: unknown) => void>();

function emitMockEvent(event: string, payload: unknown) {
  for (const handler of listeners.get(event) ?? []) handler(payload);
}

/** Fake yt-dlp progress, so the activity rail moves. */
function tickDownloadProgress() {
  let percent = 0;
  window.setInterval(() => {
    percent = (percent + 7) % 104;
    emitMockEvent("sidecar:event", { event: "download_progress", data: { percent: Math.min(percent, 100) } });
  }, 700);
}

export function installMockTauri() {
  tickDownloadProgress();
  // @tauri-apps/api v2 routes `unlisten` through this object.
  (window as unknown as Record<string, unknown>).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: () => {},
  };
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
    transformCallback: (callback: (message: unknown) => void) => {
      const id = ++callbackId;
      callbacks.set(id, callback);
      return id;
    },
    convertFileSrc: (path: string) => path,
    invoke: async (cmd: string, payload?: Record<string, unknown>) => {
      if (cmd === "plugin:event|listen") {
        const event = String(payload?.event);
        const callback = callbacks.get(Number(payload?.handler));
        if (callback) {
          const deliver = (value: unknown) => callback({ event, id: callbackId, payload: value });
          const set = listeners.get(event) ?? new Set();
          set.add(deliver);
          listeners.set(event, set);
        }
        return callbackId;
      }
      if (cmd.startsWith("plugin:event|")) return ++callbackId;
      if (cmd.startsWith("plugin:opener|")) return null;
      if (cmd === "set_api_key") {
        const key = apiKeys.find((k) => k.name === payload?.name);
        const value = String(payload?.value ?? "").trim();
        if (key) key.configured = value !== "";
        if (key?.name === "acoustid") onboarding.acoustidConfigured = key.configured;
        storedKeys.set(String(payload?.name), value);
        return key;
      }
      // A plausible AcoustID-shaped key when none was saved.
      if (cmd === "reveal_api_key") {
        const name = String(payload?.name);
        const key = apiKeys.find((k) => k.name === name);
        if (!key?.configured) return null;
        return storedKeys.get(name) ?? "mock8AcoUsTid";
      }
      // Folder requests get the import folder; file requests a cover image.
      if (cmd === "plugin:dialog|open") {
        const options = payload?.options as { directory?: boolean } | undefined;
        return options?.directory ? MOCK_IMPORT_FOLDER : "/Users/dev/Pictures/discovery-scan.jpg";
      }
      // Landscape, so the reframe slider is exercised.
      if (cmd === "allow_cover_preview") {
        return { path: thumb("#0ea5e9", "#164e63"), bytes: 4_600_000 };
      }
      if (cmd === "album_recrop_source") {
        return { path: thumb("#f472b6", "#7c3aed"), bytes: 3_100_000 };
      }
      // `?nocandidates` / `?candidatesfail` preview the empty and error states.
      if (cmd === "list_cover_candidates") {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        const search = new URLSearchParams(window.location.search);
        if (search.has("candidatesfail")) throw new Error("caa unreachable");
        if (search.has("nocandidates")) return { candidates: [] };
        return {
          candidates: [
            {
              id: "caa-1",
              thumb: thumb("#7c3aed", "#312e81"),
              image_url: "https://coverartarchive.org/release/mock/1.jpg",
              front: true,
              types: ["Front"],
            },
            {
              id: "caa-2",
              thumb: thumb("#0d9488", "#134e4a"),
              image_url: "https://coverartarchive.org/release/mock/2.jpg",
              front: false,
              types: ["Back"],
            },
            {
              id: "caa-3",
              thumb: thumb("#b45309", "#78350f"),
              image_url: "https://coverartarchive.org/release/mock/3.jpg",
              front: false,
              types: ["Medium"],
            },
          ],
        };
      }
      if (cmd === "set_album_cover") {
        const albumId = Number(payload?.albumId);
        const { tracks } = responses.list_library as { tracks: { album_id: number }[] };
        const fresh = thumb("#0ea5e9", "#164e63");
        let embedded = 0;
        for (const track of tracks as unknown as {
          album_id: number;
          art_path: string | null;
          provisional_cover?: boolean;
        }[]) {
          if (track.album_id !== albumId) continue;
          track.art_path = fresh;
          track.provisional_cover = false;
          embedded += 1;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        return { art_path: fresh, side: 180, embedded };
      }
      if (cmd === "list_artist_images") {
        return {
          images: [...artistImages].map(([name, path]) => ({ name, path, updated_at: 0 })),
        };
      }
      if (cmd === "set_artist_image") {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        artistImages.set(String(payload?.name), thumb("#7c3aed", "#312e81"));
        return { name: payload?.name, filename: "mock.jpg" };
      }
      if (cmd === "remove_artist_image") {
        return { removed: artistImages.delete(String(payload?.name)) };
      }
      if (cmd === "fetch_artist_image_url") {
        await new Promise((resolve) => window.setTimeout(resolve, 600));
        if (new URLSearchParams(window.location.search).has("urlfail")) throw new Error("not an image");
        return { path: "/tmp/mock-fetched.jpg", bytes: 2_400_000 };
      }
      // No OS pasteboard: the image read fails and the text read returns a URL,
      // exercising the clipboard → link → adopt chain.
      if (cmd === "plugin:clipboard-manager|read_image") throw new Error("no image on the mock clipboard");
      if (cmd === "plugin:clipboard-manager|read_text") return "https://example.com/mock-copied-cover.jpg";
      if (cmd === "save_pasted_image") {
        return { path: "/tmp/mock-pasted.png", bytes: 1_000_000 };
      }
      if (cmd === "list_playlists") return { playlists: mockPlaylists.map((row) => ({ ...row })) };
      if (cmd === "create_playlist") {
        const name = String(payload?.name ?? "").trim();
        if (name === "") throw "invalid input: empty playlist name";
        if (mockPlaylists.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
          throw "invalid input: a playlist with this name already exists";
        }
        const row: MockPlaylist = {
          id: nextPlaylistId++,
          name,
          kind: "user",
          cover_path: null,
          marker: null,
          created_at: Date.now(),
          updated_at: Date.now(),
          item_ids: [],
        };
        mockPlaylists.push(row);
        mockPlaylists.sort((a, b) => a.name.localeCompare(b.name));
        return { playlist: { ...row } };
      }
      if (cmd === "rename_playlist") {
        const row = mockPlaylist(payload?.id);
        if (row.kind === "favorites") throw "invalid input: the favorites playlist cannot be renamed";
        row.name = String(payload?.name ?? "").trim();
        mockPlaylists.sort((a, b) => a.name.localeCompare(b.name));
        return { ok: true };
      }
      if (cmd === "delete_playlist") {
        if (mockPlaylist(payload?.id).kind === "favorites") {
          throw "invalid input: the favorites playlist cannot be deleted";
        }
        const index = mockPlaylists.findIndex((row) => row.id === Number(payload?.id));
        if (index >= 0) mockPlaylists.splice(index, 1);
        return { ok: true };
      }
      if (cmd === "set_playlist_cover") {
        const row = mockPlaylist(payload?.id);
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        row.cover_path = thumb("#0ea5e9", "#164e63");
        row.updated_at = Date.now();
        return { id: row.id, filename: "mock.jpg" };
      }
      if (cmd === "set_playlist_marker") {
        const row = mockPlaylist(payload?.id);
        row.marker = String(payload?.marker ?? "") || null;
        row.updated_at = Date.now();
        return { ok: true };
      }
      if (cmd === "remove_playlist_cover") {
        const row = mockPlaylist(payload?.id);
        const had = row.cover_path != null;
        row.cover_path = null;
        return { removed: had };
      }
      if (cmd === "add_playlist_tracks") {
        const row = mockPlaylist(payload?.id);
        const present = new Set(row.item_ids);
        const incoming = (payload?.itemIds as number[]) ?? [];
        const fresh = incoming.filter((id) => !present.has(id) && present.add(id));
        row.item_ids.push(...fresh);
        row.updated_at = Date.now();
        return { added: fresh.length, skipped: incoming.length - fresh.length };
      }
      if (cmd === "remove_playlist_tracks") {
        const row = mockPlaylist(payload?.id);
        const doomed = new Set((payload?.positions as number[]) ?? []);
        const before = row.item_ids.length;
        row.item_ids = row.item_ids.filter((_, position) => !doomed.has(position));
        row.updated_at = Date.now();
        return { removed: before - row.item_ids.length };
      }
      if (cmd === "move_playlist_track") {
        const row = mockPlaylist(payload?.id);
        const [moved] = row.item_ids.splice(Number(payload?.from), 1);
        if (moved != null) row.item_ids.splice(Number(payload?.to), 0, moved);
        row.updated_at = Date.now();
        return { ok: true };
      }
      // Matches `currentVersion` below, so `?update` shows 0.8.0 → 0.9.0.
      if (cmd === "plugin:app|version") return "0.8.0";
      // Opt-in with `?update`; the body is a real release-please changelog.
      if (cmd === "plugin:updater|check") {
        return new URLSearchParams(window.location.search).has("update")
          ? { rid: 1, currentVersion: "0.8.0", version: "0.9.0", date: null, body: MOCK_RELEASE_BODY, rawJson: {} }
          : null;
      }
      if (cmd === "plugin:updater|download_and_install") return null;
      if (cmd.startsWith("plugin:updater|") || cmd.startsWith("plugin:process|")) return null;
      if (cmd === "scan_import_folder") return mockScan(String(payload?.path ?? ""));
      if (cmd === "start_library_import")
        return mockLibraryImport(String(payload?.folder ?? ""), payload as Record<string, unknown>);
      if (cmd === "cancel_library_import") {
        mockImportCancelRequested = true;
        return null;
      }
      if (cmd === "list_jobs_page") {
        const all = isEmpty ? [] : jobs;
        const offset = Number(payload?.offset ?? 0);
        const limit = Number(payload?.limit ?? 25);
        const terminal = new Set(["done", "failed", "cancelled"]);
        return {
          jobs: all.slice(offset, offset + limit),
          total: all.length,
          terminalTotal: all.filter((job) => terminal.has(String(job.status))).length,
        };
      }
      // Mirrors `JobsState::target_albums`.
      if (cmd === "download_target_albums") {
        const terminal = new Set(["done", "failed", "cancelled"]);
        return (isEmpty ? [] : jobs)
          .filter((job) => !terminal.has(String(job.status)))
          .map((job) => job.forcedAlbum?.albumId)
          .filter((id): id is number => id != null);
      }
      if (cmd === "list_imports") return [...mockImports];
      if (cmd === "preview_import_undo") return mockUndoPreview(String(payload?.id ?? ""));
      if (cmd === "undo_import") return mockUndo(String(payload?.id ?? ""));
      if (cmd === "library_align_scan") return mockAlignScan();
      if (cmd === "library_align_apply") return mockAlignApply(payload);
      if (cmd === "get_env_status") {
        // `?splash[=ms]` delays the answer so the splash can be seen.
        const held = new URLSearchParams(window.location.search).get("splash");
        if (held !== null) await new Promise((resolve) => window.setTimeout(resolve, Number(held) || 2000));
        return { ...env };
      }
      if (cmd === "setup_env") return runMockSetup();
      if (cmd === "reveal_log_file") return null;
      if (cmd === "get_onboarding_state") return { ...onboarding };
      if (cmd === "set_onboarding_completed") {
        onboarding.completed = Boolean(payload?.completed);
        return { ...onboarding };
      }
      // Only `bad` fails.
      if (cmd === "check_acoustid_key") {
        const valid = String(payload?.key ?? "").trim() !== "bad";
        return { valid, reason: valid ? null : "invalidKey" };
      }
      // One of each verdict.
      if (cmd === "check_services") {
        return {
          services: [
            { name: "musicbrainz", state: "up", detail: "200" },
            { name: "acoustid", state: "up", detail: "400" },
            { name: "coverart", state: "up", detail: "200" },
            { name: "lastfm", state: "down", detail: "503" },
            { name: "lrclib", state: "unreachable", detail: "ReadTimeout" },
            { name: "lyricsovh", state: "up", detail: "200" },
          ],
        };
      }
      if (cmd === "get_library_location") {
        return {
          path: "/Users/preview/Music/Sonarche",
          defaultPath: "/Users/preview/Music/Sonarche",
          isDefault: true,
        };
      }
      // Cross-volume; a folder under /Users/preview is refused.
      if (cmd === "check_library_move") {
        const parent = String(payload?.parent ?? "");
        return {
          target: `${parent}/Sonarche`,
          refusal: parent.startsWith("/Users/preview/Music/Sonarche") ? "intoItself" : null,
          fileCount: 12_412,
          sizeBytes: 68_400_000_000,
          sameVolume: false,
        };
      }
      if (cmd === "set_audio_format") {
        preferences.audioFormat = String(payload?.format ?? preferences.audioFormat);
        return preferences;
      }
      // Paced so the three phases can be watched.
      if (cmd === "convert_library") {
        const total = 12;
        for (let done = 0; done <= total; done++) {
          window.setTimeout(() => {
            emitMockEvent("sidecar:event", {
              event: "convert_progress",
              data: {
                done,
                total,
                format: preferences.audioFormat,
                title: `Track ${done}`,
                artist: "Mock",
                failed: 0,
              },
            });
          }, done * 250);
        }
        await new Promise((resolve) => window.setTimeout(resolve, (total + 1) * 250));
        return { format: preferences.audioFormat, total, converted: total, failed: 0, skipped: 3 };
      }
      if (cmd === "set_rate_limit_delay") {
        const field = preferenceFields[String(payload?.key)];
        if (field) preferences[field] = Number(payload?.seconds ?? preferences[field]);
        return preferences;
      }
      // Must return a job with an `id`, or React renders a keyless row.
      if (cmd === "enqueue_download") {
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
      }
      // Terminal jobs and all imports; running jobs stay.
      if (cmd === "clear_job_history") {
        for (let i = jobs.length - 1; i >= 0; i--) {
          const status = (jobs[i] as { status?: string }).status;
          if (status === "done" || status === "failed" || status === "cancelled") jobs.splice(i, 1);
        }
        mockImports.length = 0;
        return [...jobs];
      }
      if (cmd === "retry_job") {
        const target = jobs.find((j) => j.id === payload?.id);
        if (!target) return {};
        Object.assign(target, { status: "queued", error: null, failedStep: null });
        return target;
      }
      if (cmd === "preview_download_undo") {
        const target = jobs.find((j) => j.id === payload?.id) as { tracks?: { itemId?: number | null }[] } | undefined;
        const count = target?.tracks?.filter((t) => t.itemId != null).length || 1;
        return { tracks: count, albumsRemoved: 1, albumsKept: 0, playlistEntries: 2 };
      }
      if (cmd === "undo_download") {
        const target = jobs.find((j) => j.id === payload?.id) as
          { undoneAt?: number; tracks?: { itemId?: number | null }[] } | undefined;
        if (!target) return {};
        target.undoneAt = Date.now();
        const count = target.tracks?.filter((t) => t.itemId != null).length || 1;
        return { removed: count, foreign: 0, playlistEntries: 2 };
      }
      if (cmd === "change_job_destination") {
        const target = jobs.find((j) => j.id === payload?.id);
        if (!target) return {};
        Object.assign(target, { forcedAlbum: payload?.forcedAlbum ?? null, updatedAt: Date.now() });
        return target;
      }
      if (cmd === "cancel_job") {
        const target = jobs.find((j) => j.id === payload?.id);
        if (!target) return {};
        Object.assign(target, { status: "cancelled", error: null, failedStep: null });
        for (const track of (target as { tracks: { status: string }[] }).tracks) {
          if (track.status === "downloading") track.status = "pending";
        }
        return target;
      }
      // Write to the seed so a re-list reflects the edit.
      if (cmd === "update_tracks") {
        const wireKey: Record<string, string> = { albumartist: "album_artist", tracktotal: "track_total" };
        const numeric = new Set(["year", "track", "tracktotal"]);
        let updated = 0;
        for (const u of (payload?.updates as { id: number; fields: Record<string, string> }[]) ?? []) {
          const target = libraryTracks.find((track) => track.id === u.id) as Record<string, unknown> | undefined;
          if (!target) continue;
          for (const [key, value] of Object.entries(u.fields)) {
            target[wireKey[key] ?? key] = numeric.has(key) ? Number(value) || null : value || null;
          }
          updated += 1;
        }
        return { updated };
      }
      if (cmd === "set_album_kind") {
        const ids = new Set((payload?.albumIds as number[]) ?? []);
        const kind = payload?.kind === "collection" ? "collection" : null;
        // `list_library`'s rows are copies made at load: write to those.
        const { tracks } = responses.list_library as { tracks: { album_id: number; album_kind?: string | null }[] };
        let updated = 0;
        for (const track of tracks) {
          if (!ids.has(track.album_id)) continue;
          track.album_kind = kind;
          updated += 1;
        }
        return { updated };
      }
      // Rebuckets every track with the genre; the original bucket is remembered
      // for reset.
      if (cmd === "set_genre_family") {
        const genre = String(payload?.genre ?? "").trim();
        const family = (payload?.family as string | null) ?? null;
        const key = genre.toLowerCase();
        const { tracks } = responses.list_library as {
          tracks: { genre: string | null; genre_bucket: string | null }[];
        };
        const matching = tracks.filter((track) => (track.genre ?? "").toLowerCase() === key);
        if (!mockBaseBuckets.has(key)) mockBaseBuckets.set(key, matching[0]?.genre_bucket ?? null);
        const target = family ?? mockBaseBuckets.get(key) ?? null;
        for (const track of matching) track.genre_bucket = target;
        if (family == null || family === mockBaseBuckets.get(key)) mockGenreOverrides.delete(key);
        else mockGenreOverrides.set(key, family);
        return { genre, family: target, overridden: mockGenreOverrides.has(key) };
      }
      if (cmd === "list_genre_overrides") {
        return { overrides: [...mockGenreOverrides].map(([genre, family]) => ({ genre, family })) };
      }
      if (cmd === "move_tracks") {
        const spec = payload?.spec as {
          itemIds: number[];
          targetAlbumId?: number;
          newAlbum?: { album: string; albumartist: string };
          kind?: string;
          renumber?: boolean;
        };
        const { tracks } = responses.list_library as { tracks: Record<string, unknown>[] };
        const created = spec.targetAlbumId == null;
        const targetAlbumId = created
          ? Math.max(0, ...tracks.map((track) => Number(track.album_id) || 0)) + 1
          : Number(spec.targetAlbumId);
        const residents = tracks.filter((track) => track.album_id === targetAlbumId);
        if (!created && residents.length === 0) throw new Error("album not found");
        const album = created ? spec.newAlbum!.album : String(residents[0].album);
        const albumArtist = created ? spec.newAlbum!.albumartist : String(residents[0].album_artist ?? "");
        const targetKind = spec.kind
          ? spec.kind === "collection"
            ? "collection"
            : null
          : created
            ? null
            : ((residents[0]?.album_kind as string | null) ?? null);
        const targetArt = created ? null : ((residents[0]?.art_path as string | null) ?? null);

        let next = spec.renumber ? Math.max(0, ...residents.map((track) => Number(track.track) || 0)) : 0;
        const sources = new Set<number>();
        let moved = 0;
        let skipped = 0;
        for (const id of spec.itemIds) {
          const track = tracks.find((candidate) => candidate.id === id);
          if (!track) continue;
          if (track.album_id === targetAlbumId) {
            skipped += 1;
            continue;
          }
          if (track.album_id != null) sources.add(track.album_id as number);
          track.album_id = targetAlbumId;
          track.album = album;
          track.album_artist = albumArtist;
          track.art_path = targetArt;
          if (spec.renumber) {
            track.track = ++next;
            track.track_total = null;
          }
          moved += 1;
        }
        for (const track of tracks) {
          if (track.album_id === targetAlbumId) track.album_kind = targetKind;
        }
        const sourcesRemoved = [...sources].filter(
          (sourceId) => !tracks.some((track) => track.album_id === sourceId),
        ).length;
        await new Promise((resolve) => window.setTimeout(resolve, 400));
        return { moved, skipped, created, target_album_id: targetAlbumId, sources_removed: sourcesRemoved };
      }
      if (cmd === "set_check_accepted") {
        const ids = new Set((payload?.ids as number[]) ?? []);
        const check = String(payload?.check);
        const on = Boolean(payload?.accepted);
        const isAlbum = payload?.scope === "album";
        const scope = isAlbum ? "album_accepted" : "accepted";
        const { tracks } = responses.list_library as { tracks: Record<string, unknown>[] };
        let updated = 0;
        for (const track of tracks) {
          const key = isAlbum ? (track.album_id as number) : (track.id as number);
          if (!ids.has(key)) continue;
          const current = new Set((track[scope] as string[]) ?? []);
          if (on) current.add(check);
          else current.delete(check);
          track[scope] = [...current].sort();
          updated += 1;
        }
        return { updated };
      }
      // Slow, so the album loop's progress and Stop button can be seen.
      if (cmd === "reenrich_track") {
        return new Promise((resolve) => window.setTimeout(() => resolve({ matched: true }), 1200));
      }
      if (cmd === "fetch_lyrics") return mockLyrics(payload);
      // Fake playhead: the Rust engine owns playback.
      if (cmd.startsWith("player_") || cmd === "now_playing_set") return mockPlayback(cmd, payload);
      return responses[cmd] ?? {};
    },
  };
}

const playback = { position: 0, duration: 0, isPlaying: false, loaded: false, queued: 0, timer: 0 };

function emitPlaybackStatus() {
  const { position, duration, isPlaying, loaded, queued } = playback;
  emitMockEvent("player:status", { position, duration, isPlaying, loaded, queued });
}

function tickPlayback() {
  window.clearInterval(playback.timer);
  playback.timer = window.setInterval(() => {
    if (!playback.isPlaying) return;
    playback.position += 0.25;
    if (playback.duration > 0 && playback.position >= playback.duration) {
      playback.position = 0;
      playback.isPlaying = false;
      playback.loaded = false;
      emitMockEvent("player:ended", null);
    }
    emitPlaybackStatus();
  }, 250);
}

/** Long enough to exercise middle truncation. */
const MOCK_IMPORT_FOLDER = "/Volumes/Backup/archive/2011/music/rips/FLAC";

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
const mockImports: unknown[] = [
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

/**
 * Placeholder lyrics (not a real song) reproducing each answer's shape:
 * 100 has stored lyrics, 101 and 102 need the button, 200 is instrumental.
 */
const mockLyricLines = (offset: number) =>
  [
    ...["Placeholder verse, first line", "Placeholder verse, second line", ""],
    ...["Placeholder chorus, over and over", "Placeholder chorus, once again", ""],
    ...["Placeholder second verse, first line", "Placeholder second verse, second line", ""],
    ...["Placeholder chorus, over and over", "Placeholder chorus, once again", ""],
    ...["Placeholder bridge, quietly", "Placeholder bridge, quieter still", ""],
    ...["Placeholder chorus, over and over", "Placeholder chorus, once again"],
    "Placeholder verse, last line",
    // Long enough to exercise the scroll that follows the playhead.
  ].map((text, index) => ({ time: offset + index * 4, text }));

async function mockLyrics(payload?: Record<string, unknown>): Promise<unknown> {
  const id = Number(payload?.id ?? 0);
  const allowNetwork = Boolean(payload?.allowNetwork);
  const force = Boolean(payload?.force);
  const answer = (over: Record<string, unknown> = {}) => ({
    source: null,
    plain: null,
    lines: [],
    instrumental: false,
    unreachable: false,
    ...over,
  });
  const plainBody =
    "Placeholder verse, first line\nPlaceholder verse, second line\n\nPlaceholder chorus, over and over";

  if (id === 100 && !force)
    return answer({ source: "lrclib", plain: "Placeholder verse, first line", lines: mockLyricLines(6) });
  if (!allowNetwork) return answer();

  await new Promise((resolve) => window.setTimeout(resolve, 900));
  if (id === 100) return answer({ source: "lrclib", plain: "Placeholder verse, first line", lines: mockLyricLines(6) });
  if (id === 101) return answer({ source: "lrclib", plain: "Placeholder verse, first line", lines: mockLyricLines(4) });
  // Plain text until "look again" returns timed lyrics.
  if (id === 102)
    return force
      ? answer({ source: "lrclib", plain: plainBody, lines: mockLyricLines(5) })
      : answer({ source: "lyrics.ovh", plain: plainBody });
  // LRCLIB accepting the connection and never answering.
  if (id === 103) return answer({ unreachable: true });
  if (id === 200) return answer({ source: "lrclib", instrumental: true });
  return answer();
}

function mockPlayback(cmd: string, payload?: Record<string, unknown>): unknown {
  switch (cmd) {
    case "player_load":
      // Same wording as the engine: `playbackError.ts` matches the prefix.
      if (!isPlayablePath(String(payload?.path ?? ""))) {
        throw `unsupported audio format: ${String(payload?.path ?? "")}`;
      }
      playback.position = 0;
      playback.duration = 214;
      playback.isPlaying = true;
      playback.loaded = true;
      tickPlayback();
      return playback.duration;
    case "player_toggle":
      playback.isPlaying = !playback.isPlaying;
      return playback.isPlaying;
    case "player_seek":
      playback.position = Number(payload?.seconds ?? 0);
      emitPlaybackStatus();
      return null;
    case "player_stop":
      playback.isPlaying = false;
      playback.loaded = false;
      return null;
    case "now_playing_set":
      // Acknowledged; `emitMockEvent("player:remote", …)` simulates a media key.
      return null;
    default:
      return null;
  }
}
