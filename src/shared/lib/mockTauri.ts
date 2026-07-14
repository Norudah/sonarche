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
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

const jobs = [
  job({ status: "downloading", title: "Nothing Else Matters", artist: "Metallica", duration: 386, createdAt: now - 1000 }),
  job({ status: "queued", createdAt: now - 2000 }),
  job({ status: "importing", title: "Knock Knock", artist: "Scattle", duration: 213, createdAt: now - 3000 }),
  job({
    status: "done", title: "Monster", artist: "Skillet", duration: 178, createdAt: now - 4000,
    report: {
      mb_matched: true, source: "MusicBrainz",
      fields: { title: true, artist: true, album: true, year: true, track: true, genre: false },
      cover: true, cover_source: "Cover Art Archive",
    },
  }),
  job({
    status: "done", title: "Commander's Theme", artist: "The Algorithm", duration: 201, createdAt: now - 5000,
    report: {
      mb_matched: false, source: null,
      fields: { title: true, artist: true, album: false, year: false, track: false, genre: false },
      cover: false, cover_source: null,
    },
  }),
  job({ status: "failed", failedStep: "download", error: "yt-dlp: video unavailable", createdAt: now - 6000 }),
  job({ status: "failed", failedStep: "import", title: "Some Track", artist: "Someone", error: "beet import failed (exit 1)", createdAt: now - 7000 }),
];

const apiKeys = [{ name: "acoustid", configured: false }];

const responses: Record<string, unknown> = {
  get_env_status: {
    python: { path: "/usr/bin/python3", version: "3.12.0" },
    venvOk: true,
    depsOk: true,
    libraryDir: "/Users/dev/Music/Sonarche",
  },
  list_jobs: jobs,
  list_library: { tracks: [] },
  list_api_keys: apiKeys,
};

let callbackId = 0;

export function installMockTauri() {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
    transformCallback: () => ++callbackId,
    invoke: async (cmd: string, payload?: Record<string, unknown>) => {
      if (cmd.startsWith("plugin:event|")) return ++callbackId;
      if (cmd === "set_api_key") {
        const key = apiKeys.find((k) => k.name === payload?.name);
        if (key) key.configured = String(payload?.value ?? "").trim() !== "";
        return key;
      }
      return responses[cmd] ?? {};
    },
  };
}
