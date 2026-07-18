/** Dev-only Tauri IPC stub so the UI can be previewed in a plain browser
 * (`vite dev` + `?mockTauri`). Never bundled in production builds. */

const now = Date.now();

/** Stand-in for a YouTube thumbnail: 16:9 like the real thing, so the queue's
 * square artwork slot is exercised with the aspect ratio it actually crops. */
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

// `provisional`: nothing identified the file, so the sidecar guessed its tags
// from the video and from the siblings' release — everything but the genre and
// the track number, which are never guessed.
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
    tracks: [
      albumTrack({ index: 1, videoId: "a1", title: "Intro (Blizzard)", duration: 154, status: "done", itemId: 2, downloadAttempts: 2, report: trackReport(2, true) }),
      albumTrack({ index: 2, videoId: "a2", title: "Hollywood Heights", duration: 231, status: "imported", itemId: 8, downloadAttempts: 1, report: trackReport(8, false) }),
      albumTrack({ index: 3, videoId: "a3", title: "Java", duration: 197, status: "downloading", downloadAttempts: 2 }),
      albumTrack({ index: 4, videoId: "a4", title: "Untitled (Deleted Video)", status: "failed", error: "yt-dlp: video unavailable", downloadAttempts: 3 }),
      albumTrack({ index: 5, videoId: "a5", title: "Rust", duration: 243 }),
    ],
  }),
  job({ status: "downloading", title: "Nothing Else Matters", artist: "Metallica", duration: 386, thumbnail: thumb("#0bd", "#07a"), createdAt: now - 1000 }),
  job({ status: "queued", createdAt: now - 2000 }),
  job({ status: "importing", title: "Knock Knock", artist: "Scattle", duration: 213, createdAt: now - 3000 }),
  job({ status: "enriching", title: "Nothing Else Matters", artist: "Metallica", duration: 386, createdAt: now - 3500 }),
  job({
    status: "done", title: "Monster", artist: "Skillet", duration: 178, thumbnail: thumb("#fb0", "#e40"), createdAt: now - 4000,
    report: {
      item_id: 2, mb_matched: true, source: "MusicBrainz",
      fields: { title: true, artist: true, album: true, year: true, track: true, genre: false },
      cover: true, cover_source: "Cover Art Archive",
    },
  }),
  job({
    status: "done", title: "Commander's Theme", artist: "The Algorithm", duration: 201, createdAt: now - 5000,
    report: {
      item_id: 5, mb_matched: false, provisional: true, source: null,
      fields: { title: true, artist: true, album: false, year: false, track: false, genre: false },
      cover: false, cover_source: null,
    },
  }),
  job({
    kind: "album",
    status: "done",
    url: "https://youtube.com/playlist?list=OLAK5uy_done",
    title: "Awake",
    artist: "Skillet",
    thumbnail: thumb("#2c8", "#083"),
    createdAt: now - 5500,
    tracks: [
      albumTrack({ index: 1, videoId: "b1", title: "Hero", duration: 187, status: "done", itemId: 2, report: trackReport(2, true) }),
      albumTrack({ index: 2, videoId: "b2", title: "Monster", duration: 178, status: "done", itemId: 9, report: trackReport(9, false, true) }),
      // Content duplicate dropped by the enrich step (same recording as #1).
      albumTrack({ index: 3, videoId: "b3", title: "Hero (Official Video)", duration: 187, status: "done", itemId: 11, duplicateOf: 2 }),
    ],
  }),
  job({ status: "failed", failedStep: "download", error: "yt-dlp: video unavailable", downloadAttempts: 3, createdAt: now - 6000 }),
  job({ status: "failed", failedStep: "import", title: "Some Track", artist: "Someone", error: "beet import failed (exit 1)", createdAt: now - 7000 }),
];

const apiKeys = [{ name: "acoustid", configured: false }];
const preferences = {
  lastfmFetchDelaySeconds: 1,
  acoustidLookupDelaySeconds: 0.5,
  downloadDelaySeconds: 3,
};

const preferenceFields: Record<string, keyof typeof preferences> = {
  lastfm: "lastfmFetchDelaySeconds",
  acoustid: "acoustidLookupDelaySeconds",
  download: "downloadDelaySeconds",
};

// One track matching the "Monster" job's item_id; the other done job's item is
// deliberately absent so the "removed from library" state is visible too.
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
    path: "/Users/dev/Music/Sonarche/Skillet/Monster.m4a",
    // Square cover art: the queue swaps the 16:9 YouTube thumbnail for this
    // once the enrich step has filed the item.
    art_path: thumb("#334", "#112"),
    // Adopted bonus track: exercises the origin note in the metadata drawer.
    bonus_source: "Awake: Deluxe Edition",
  },
];

const responses: Record<string, unknown> = {
  get_env_status: {
    python: { path: "/usr/bin/python3", version: "3.12.0" },
    venvOk: true,
    depsOk: true,
    libraryDir: "/Users/dev/Music/Sonarche",
  },
  list_jobs: jobs,
  list_library: { tracks: libraryTracks },
  list_api_keys: apiKeys,
  get_preferences: preferences,
};

let callbackId = 0;

export function installMockTauri() {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
    transformCallback: () => ++callbackId,
    convertFileSrc: (path: string) => path,
    invoke: async (cmd: string, payload?: Record<string, unknown>) => {
      if (cmd.startsWith("plugin:event|")) return ++callbackId;
      if (cmd === "set_api_key") {
        const key = apiKeys.find((k) => k.name === payload?.name);
        if (key) key.configured = String(payload?.value ?? "").trim() !== "";
        return key;
      }
      if (cmd === "set_rate_limit_delay") {
        const field = preferenceFields[String(payload?.key)];
        if (field) preferences[field] = Number(payload?.seconds ?? preferences[field]);
        return preferences;
      }
      return responses[cmd] ?? {};
    },
  };
}
