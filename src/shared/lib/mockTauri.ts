/** Dev-only Tauri IPC stub so the UI can be previewed in a plain browser
 * (`vite dev` + `?mockTauri`). Never bundled in production builds. */

const now = Date.now();

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
    ...over,
  };
}

const trackReport = (item_id: number | null, mb_matched: boolean) => ({
  item_id,
  mb_matched,
  source: mb_matched ? "MusicBrainz" : null,
  fields: {
    title: mb_matched,
    artist: mb_matched,
    album: mb_matched,
    year: mb_matched,
    track: mb_matched,
    genre: false,
  },
  cover: mb_matched,
  cover_source: mb_matched ? "Cover Art Archive" : null,
});

const jobs = [
  job({
    kind: "album",
    status: "downloading",
    url: "https://youtube.com/playlist?list=OLAK5uy_mock",
    title: "Hotline Miami 2: Wrong Number OST",
    artist: "Various Artists",
    createdAt: now - 500,
    tracks: [
      albumTrack({ index: 1, videoId: "a1", title: "Intro (Blizzard)", duration: 154, status: "done", itemId: 2, report: trackReport(2, true) }),
      albumTrack({ index: 2, videoId: "a2", title: "Hollywood Heights", duration: 231, status: "imported", itemId: 8, report: trackReport(8, false) }),
      albumTrack({ index: 3, videoId: "a3", title: "Java", duration: 197, status: "downloading" }),
      albumTrack({ index: 4, videoId: "a4", title: "Untitled (Deleted Video)", status: "failed", error: "yt-dlp: video unavailable" }),
      albumTrack({ index: 5, videoId: "a5", title: "Rust", duration: 243 }),
    ],
  }),
  job({ status: "downloading", title: "Nothing Else Matters", artist: "Metallica", duration: 386, createdAt: now - 1000 }),
  job({ status: "queued", createdAt: now - 2000 }),
  job({ status: "importing", title: "Knock Knock", artist: "Scattle", duration: 213, createdAt: now - 3000 }),
  job({ status: "enriching", title: "Nothing Else Matters", artist: "Metallica", duration: 386, createdAt: now - 3500 }),
  job({
    status: "done", title: "Monster", artist: "Skillet", duration: 178, createdAt: now - 4000,
    report: {
      item_id: 2, mb_matched: true, source: "MusicBrainz",
      fields: { title: true, artist: true, album: true, year: true, track: true, genre: false },
      cover: true, cover_source: "Cover Art Archive",
    },
  }),
  job({
    status: "done", title: "Commander's Theme", artist: "The Algorithm", duration: 201, createdAt: now - 5000,
    report: {
      item_id: 5, mb_matched: false, source: null,
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
    createdAt: now - 5500,
    tracks: [
      albumTrack({ index: 1, videoId: "b1", title: "Hero", duration: 187, status: "done", itemId: 2, report: trackReport(2, true) }),
      albumTrack({ index: 2, videoId: "b2", title: "Monster", duration: 178, status: "done", itemId: 9, report: trackReport(9, false) }),
    ],
  }),
  job({ status: "failed", failedStep: "download", error: "yt-dlp: video unavailable", createdAt: now - 6000 }),
  job({ status: "failed", failedStep: "import", title: "Some Track", artist: "Someone", error: "beet import failed (exit 1)", createdAt: now - 7000 }),
];

const apiKeys = [{ name: "acoustid", configured: false }];
const preferences = { lastfmFetchDelaySeconds: 1 };

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
    art_path: null,
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
      if (cmd === "set_lastfm_fetch_delay") {
        preferences.lastfmFetchDelaySeconds = Number(payload?.seconds ?? preferences.lastfmFetchDelaySeconds);
        return preferences;
      }
      return responses[cmd] ?? {};
    },
  };
}
