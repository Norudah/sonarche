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
      albumTrack({
        index: 1,
        videoId: "a1",
        title: "Intro (Blizzard)",
        duration: 154,
        status: "done",
        // 200 is the first Hotline Miami OST item below: a job row's link
        // resolves through its item ids, so reusing an unrelated id here sent
        // the row to someone else's record.
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
      // Content duplicate dropped by the enrich step (same recording as #1).
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
  // A playlist that landed while one video was pulled from YouTube. The batch
  // stays `done` — the library gained the rest — and the row reports the loss
  // as amber rather than painting the whole pipeline red.
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

/** The fixture track the engine cannot decode — one Opus file in a library of
 * AAC, which is exactly what importing someone's existing collection produces.
 * A format the player refuses is a state the UI has to draw, so it needs to be
 * reachable by clicking a row rather than only in a real install. */
const UNPLAYABLE_TITLE = "Wait";

/** Whether the mock engine would open this file. Mirrors the decoder's own
 * list (`src-tauri/src/audio_formats.rs`), short of the formats no fixture
 * uses. */
function isPlayablePath(path: string): boolean {
  return /\.(mp3|flac|m4a|m4b|mp4|aac|ogg|oga|wav|wave|aiff|aif|aifc)$/i.test(path);
}

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
    mb_trackid: "rec-monster",
    suspect_match: false,
    // The ordinary case of the axis, so the filter bar's category menu has two
    // values to choose between rather than the single one an OST-only fixture
    // would give it (a one-option menu hides itself).
    category: "Music",
    soundtrack: false,
  },
  // [title, artist, album, genre, bucket, length, year, track, cover]. The
  // bucket is what `sidecar/genre_tree.py` actually resolves for that genre,
  // not an echo of it: the genres view is built on the two levels being
  // different, so a fixture that collapses them would only ever exercise a
  // shape the real library never produces. "Dance Pop" and "Synthwave" are
  // genuinely absent from the tree — they are here to keep the Other bucket
  // populated.
  //
  // Deliberately uneven so the albums grid meets what a real library throws at it: several
  // tracks per album, a compilation whose artists differ from the album artist,
  // an album with no cover, and albums with missing genres or years (which is
  // what the completeness badge is there to surface).
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
      // No cover at all: exercises the fallback in the card and the hero.
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
    path: `/Users/dev/Music/Sonarche/${artist}/${title}.${title === UNPLAYABLE_TITLE ? "opus" : "m4a"}`,
    art_path: cover ? thumb(cover.split("|")[0], cover.split("|")[1]) : null,
    bonus_source: null,
    mb_trackid: null,
    suspect_match: false,
    category: null,
    soundtrack: false,
  })),

  // Compilation: the album artist is "Various Artists" while every track has
  // its own — the case that makes the tracklist grow an artist column.
  ...(
    [
      ["Hydrogen", "M|O|O|N", 1, 269],
      ["Roller Mobster", "Carpenter Brut", 2, 231],
      ["Knock Knock", "Scattle", 3, 213],
      // Credited to an artist who owns records elsewhere: the guest spot. It is
      // what the artist page's tracks mode marks as an appearance, and the three
      // above — who own nothing — are the case that must *not* become a link.
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
    // Not a node in the genre tree — the OST lands in Other, like it would.
    genre_bucket: null,
    track: trackNo,
    track_total: 3,
    length,
    bitrate: 256000,
    format: "AAC",
    path: `/Users/dev/Music/Sonarche/Various Artists/${title}.m4a`,
    art_path: thumb("#f43f5e", "#7c2d12"),
    bonus_source: null,
    mb_trackid: null,
    suspect_match: false,
    // Categorized soundtrack: the Categories page's first card.
    category: "Video Games",
    soundtrack: true,
  })),

  // Spirit regression: a cross-language match flagged for review, and the
  // same recording filed twice (the single re-imported inside a playlist) —
  // both land on the metadata page's review lines.
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
    path: `/Users/dev/Music/Sonarche/Bryan Adams/${title}.m4a`,
    art_path: thumb("#d97706", "#78350f"),
    bonus_source: null,
    mb_trackid: "rec-yctm",
    suspect_match: flagged,
    // MB typed the release a soundtrack but no category is set yet — the
    // drawer's pre-suggestion case.
    category: null,
    soundtrack: true,
  })),
];

/**
 * `?tracks=10000` inflates the mock library to that many rows by cloning the
 * handful above, so the browsing views can be measured at a scale nobody has
 * on disk yet. Album identity is (album artist, title), so the clones carry a
 * generation suffix — otherwise 10 000 tracks would collapse into 13 albums
 * and the grid would never be exercised.
 */
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
          // Clones share the source's recording only nominally — carrying it
          // over would flood the duplicates line at ?tracks=10000.
          mb_trackid: null,
          suspect_match: false,
        };
  });
}

const requestedTracks = Number(new URLSearchParams(window.location.search).get("tracks") ?? 0);

/**
 * Which rung of the walkthrough to open on: `?setup=python` (nothing found),
 * `?setup=engine` (an interpreter but no venv), anything else a healthy
 * install. Pair with `?onboarding=1`, which makes the gate ignore the
 * completion flag. Without this the first two steps are always satisfied and
 * their panels — the ones with the copy, the install and the log — could not be
 * looked at at all.
 */
const requestedSetup = new URLSearchParams(window.location.search).get("setup");

const env = {
  python: requestedSetup === "python" ? null : { path: "/opt/homebrew/bin/python3", version: "3.13.1" },
  venvOk: requestedSetup !== "python" && requestedSetup !== "engine",
  depsOk: requestedSetup !== "python" && requestedSetup !== "engine",
  // `?bundled` previews the app once it carries its own interpreter: the
  // Python step disappears and the remaining two renumber themselves.
  pythonBundled: new URLSearchParams(window.location.search).has("bundled"),
  libraryDir: "/Users/dev/Music/Sonarche",
};

const onboarding = { completed: requestedSetup == null, acoustidConfigured: false };

/** The lines `python_env.rs` emits, plus pip's, at a watchable pace. */
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

const responses: Record<string, unknown> = {
  list_jobs: jobs,
  list_library: { tracks: inflate(libraryTracks, requestedTracks) },
  list_api_keys: apiKeys,
  get_preferences: preferences,
};

let callbackId = 0;

/**
 * Event listeners, by event name.
 *
 * Tauri's `listen()` hands its handler to `transformCallback` and passes the
 * resulting id to `plugin:event|listen`; the backend then calls that callback
 * by id. The stub used to number the callbacks and drop them, so nothing the
 * backend pushes ever arrived — fine while every mocked screen was
 * request/response, but the player is driven entirely by pushed status, and
 * would sit frozen here.
 */
const listeners = new Map<string, Set<(payload: unknown) => void>>();
const callbacks = new Map<number, (message: unknown) => void>();

/** Deliver an event to whatever subscribed to it, as the backend would. */
export function emitMockEvent(event: string, payload: unknown) {
  for (const handler of listeners.get(event) ?? []) handler(payload);
}

/**
 * A fake yt-dlp reporting bytes.
 *
 * The activity feed's rail is driven by these events, so without them the one
 * thing this preview exists to show — a download visibly advancing — is a bar
 * frozen at zero. Same reasoning as the fake playhead below: the state the UI
 * spends its life in is the one a static fixture cannot reach.
 */
function tickDownloadProgress() {
  let percent = 0;
  window.setInterval(() => {
    percent = (percent + 7) % 104;
    emitMockEvent("sidecar:event", { event: "download_progress", data: { percent: Math.min(percent, 100) } });
  }, 700);
}

export function installMockTauri() {
  tickDownloadProgress();
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
      // No browser to hand off to; the walkthrough's link rows still exercise
      // their own path.
      if (cmd.startsWith("plugin:opener|")) return null;
      if (cmd === "set_api_key") {
        const key = apiKeys.find((k) => k.name === payload?.name);
        if (key) key.configured = String(payload?.value ?? "").trim() !== "";
        if (key?.name === "acoustid") onboarding.acoustidConfigured = key.configured;
        return key;
      }
      // The OS folder picker, standing in for a choice that cannot be made in a
      // browser. Always the same folder, so the summary below is about it.
      if (cmd === "plugin:dialog|open") return MOCK_IMPORT_FOLDER;
      // Opt-in: an update prompt on every preview would sit over whatever is
      // being looked at. `?update` is how you go and look at it on purpose.
      if (cmd === "plugin:updater|check") {
        return new URLSearchParams(window.location.search).has("update")
          ? { rid: 1, currentVersion: "0.8.0", version: "0.9.0", date: null, body: null, rawJson: {} }
          : null;
      }
      if (cmd === "plugin:updater|download_and_install") return null;
      if (cmd.startsWith("plugin:updater|") || cmd.startsWith("plugin:process|")) return null;
      if (cmd === "scan_import_folder") return mockScan(String(payload?.path ?? ""));
      if (cmd === "start_library_import") return mockLibraryImport(String(payload?.folder ?? ""));
      if (cmd === "get_env_status") return { ...env };
      if (cmd === "setup_env") return runMockSetup();
      if (cmd === "get_onboarding_state") return { ...onboarding };
      if (cmd === "set_onboarding_completed") {
        onboarding.completed = Boolean(payload?.completed);
        return { ...onboarding };
      }
      // Anything but `bad` passes, so both verdicts can be seen without a real
      // key — and the rejection is the one worth looking at.
      if (cmd === "check_acoustid_key") {
        const valid = String(payload?.key ?? "").trim() !== "bad";
        return { valid, reason: valid ? null : "invalidKey" };
      }
      if (cmd === "set_rate_limit_delay") {
        const field = preferenceFields[String(payload?.key)];
        if (field) preferences[field] = Number(payload?.seconds ?? preferences[field]);
        return preferences;
      }
      // These two must mint a real job: the unhandled `{}` fallback used to
      // yield a job with no `id`, which React then rendered as a keyless row.
      if (cmd === "enqueue_download") {
        const queued = job({
          url: String(payload?.url ?? ""),
          kind: String(payload?.kind ?? "single"),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        jobs.unshift(queued);
        return queued;
      }
      if (cmd === "retry_job") {
        const target = jobs.find((j) => j.id === payload?.id);
        if (!target) return {};
        Object.assign(target, { status: "queued", error: null, failedStep: null });
        return target;
      }
      // Apply edits to the in-memory seed so a re-list reflects them — without
      // this the drawer would "save" and then snap back to the static fixture.
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
      // The Rust engine owns playback, so a browser preview has none. A fake
      // playhead is what keeps the player bar, the seek bar and the queue panel
      // explorable here: without it nothing ever advances and "playing" is a
      // state the UI can never be seen in.
      if (cmd.startsWith("player_") || cmd === "now_playing_set") return mockPlayback(cmd, payload);
      return responses[cmd] ?? {};
    },
  };
}

/** Stand-in for the Rust engine: enough state to drive the UI, no audio. */
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

/** The folder the mock picker always returns. Long enough to exercise the
 * middle-truncation the real paths get. */
const MOCK_IMPORT_FOLDER = "/Volumes/Backup/archive/2011/music/rips/FLAC";

/**
 * A library worth confirming: a few thousand tracks, tens of gigabytes, and a
 * handful of files in formats the engine cannot decode — the caveat the summary
 * exists to show. `?emptyImport` gives the other verdict, a folder with no music
 * in it, which is the mistake people actually make.
 */
function mockScan(path: string): unknown {
  if (new URLSearchParams(window.location.search).has("emptyImport")) {
    return {
      playable: 0,
      unplayable: 0,
      unplayableByExtension: {},
      unplayableExamples: [],
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
    bytes: 31_400_000_000,
    truncated: false,
  };
}

/** The albums the mock import walks through. Named, because the point of the
 * progress line is that it says which record is being copied. */
const MOCK_IMPORT_FOLDERS = [
  "Aphex Twin/Selected Ambient Works 85-92",
  "Boards of Canada/Music Has the Right to Children",
  "Burial/Untrue",
  "Fever Ray/Fever Ray",
  "Portishead/Dummy",
  "The Avalanches/Since I Left You",
];

/**
 * An import that takes visible time.
 *
 * Instant would hide the one state worth previewing. `?failImport` stops it
 * partway instead — the failure has to be drawable too, and it is the state
 * nobody thinks to look at.
 */
async function mockLibraryImport(folder: string): Promise<unknown> {
  const failAt = new URLSearchParams(window.location.search).has("failImport") ? 3 : Infinity;

  for (const [index, album] of MOCK_IMPORT_FOLDERS.entries()) {
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    if (index + 1 === failAt) {
      throw `beet import failed (exit 1): could not read ${folder}/${album}`;
    }
    emitMockEvent("sidecar:event", {
      event: "library_import_progress",
      data: { folders: index + 1, folder: `${folder}/${album}` },
    });
  }

  // The cover pass that follows the copy: a second count of different things,
  // which the bar has to restart for rather than crawl the last inch.
  for (let done = 1; done <= MOCK_IMPORT_FOLDERS.length; done += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    emitMockEvent("sidecar:event", {
      event: "library_covers_progress",
      data: { done, total: MOCK_IMPORT_FOLDERS.length, renditions: Math.ceil(done / 2) },
    });
  }

  return { folders: MOCK_IMPORT_FOLDERS.length, renditions: Math.ceil(MOCK_IMPORT_FOLDERS.length / 2) };
}

function mockPlayback(cmd: string, payload?: Record<string, unknown>): unknown {
  switch (cmd) {
    case "player_load":
      // The one failure the player has to speak out loud. Refused here the way
      // the real engine refuses it — same wording, because the front reads that
      // prefix to name the format (see shared/player/playbackError.ts).
      if (!isPlayablePath(String(payload?.path ?? ""))) {
        throw `unsupported audio format: ${String(payload?.path ?? "")}`;
      }
      // A plausible length, since there is no file to decode.
      playback.position = 0;
      playback.duration = 214;
      playback.isPlaying = true;
      playback.loaded = true;
      tickPlayback();
      return playback.duration;
    case "player_toggle":
      playback.isPlaying = !playback.isPlaying;
      return playback.isPlaying;
    case "player_pause":
      playback.isPlaying = false;
      return null;
    case "player_seek":
      playback.position = Number(payload?.seconds ?? 0);
      emitPlaybackStatus();
      return null;
    case "player_stop":
      playback.isPlaying = false;
      playback.loaded = false;
      return null;
    case "player_status":
      return { ...playback };
    case "now_playing_set":
      // No OS session in a browser; the call is acknowledged so the front's
      // path is exercised, and `emitMockEvent("player:remote", …)` from the
      // console stands in for a media key.
      return null;
    default:
      return null;
  }
}
