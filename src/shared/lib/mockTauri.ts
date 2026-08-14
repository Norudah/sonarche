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
    // Bound for an existing record — album 1 is Skillet's "Awake", the first
    // one `withAlbumIds` numbers. It is what makes the delete guard reachable
    // in the preview: that album refuses to be deleted while this job runs.
    forcedAlbum: { title: "Awake", artist: "Skillet", albumId: 1 },
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
    // Two dead playlist slots (deleted/private videos), skipped at probe:
    // exercises the detail panel's "album may be incomplete" notice.
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
  // Stopped by the user mid-download: terminal without an error, retryable,
  // and its tracks keep the resume markers a retry would pick up.
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
// The API delays mirror the backend's fixed defaults — `preferences.rs` stamps
// them on every load, so the mock must never show a value the app can't hold.
const preferences = {
  lastfmFetchDelaySeconds: 1,
  acoustidLookupDelaySeconds: 1,
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
const MOCK_RELEASE_BODY = `## [0.9.0](https://github.com/Norudah/sonarche/compare/sonarche-v0.8.0...sonarche-v0.9.0) (2026-08-12)

### En bref

* Un clic sur une pochette l'agrandit, et tu peux la recadrer sans la remplacer.
* La langue se choisit dès l'installation.
* Chaque suppression demande confirmation, partout.

### Features

* **library:** let a cover be recropped in place ([1a2b3c4](https://github.com/Norudah/sonarche/commit/1a2b3c4d))
* **onboarding:** pick the language during setup ([5e6f7a8](https://github.com/Norudah/sonarche/commit/5e6f7a8b))
* **shell:** name the two modes on the lens toggle ([8607459](https://github.com/Norudah/sonarche/commit/86074590))

### Bug Fixes

* **ui:** mark every delete as destructive ([9b8c7d6](https://github.com/Norudah/sonarche/commit/9b8c7d6e))
* **shell:** keep the app's name on the Windows window ([f9d5943](https://github.com/Norudah/sonarche/commit/f9d59430))
`;

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
    path: "/Users/dev/Music/Sonarche/Music/Skillet/Monster.m4a",
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
    path: `/Users/dev/Music/Sonarche/Music/${artist}/${title}.${title === UNPLAYABLE_TITLE ? "opus" : "m4a"}`,
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
    path: `/Users/dev/Music/Sonarche/Music/Various Artists/${title}.m4a`,
    art_path: thumb("#f43f5e", "#7c2d12"),
    bonus_source: null,
    mb_trackid: null,
    suspect_match: false,
    // A forced album that found no artwork of its own and kept the video's
    // thumbnail — the state the album panel's cover notice exists to report,
    // and one nothing else in the mock could reach.
    provisional_cover: true,
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
    path: `/Users/dev/Music/Sonarche/Music/Bryan Adams/${title}.m4a`,
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

/** beets album ids, assigned per (album artist, album) group — what the cover
 * replacement keys its write on. */
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

/**
 * `?empty` answers every listing with nothing.
 *
 * The mock's whole job is to make states reachable, and the emptiest one — a
 * library and a history with nothing in them, which is what the very first
 * launch looks like — was the one state the seed data made unreachable.
 */
const isEmpty = new URLSearchParams(window.location.search).has("empty");

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

/** Artist images this preview session set, name -> stand-in path. Starts
 * empty on purpose: the generated motif is the shipped default. */
const artistImages = new Map<string, string>();

/**
 * The playlists store, mutated in place as the Rust commands would. The
 * favorites row is always there (the backend seeds it at startup); the user
 * rows cover three shapes worth looking at: a mixed list long enough for the
 * 2×2 mosaic, a single-album list (one cover, not four copies of it), and one
 * carrying a dead item id — the pruned-library case the views must absorb.
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
          // The three nav faces, one per row: a picked icon, a colour chip and
          // the default glyph — so the sidebar shows all of them at once.
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
          // The thumbnail mode: a playlist with an image of its own, wearing it
          // in the navigation.
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

// The user's genre placements and, per touched genre, the bucket the seed had
// before the first override — enough to make reset honest in the mock.
const mockGenreOverrides = new Map<string, string>();
const mockBaseBuckets = new Map<string, string | null>();

const responses: Record<string, unknown> = {
  list_jobs: isEmpty ? [] : jobs,
  remux_library: { scanned: 0, fragmented: 0, remuxed: 0, failed: [] },
  list_library: { tracks: isEmpty ? [] : withAlbumIds(inflate(libraryTracks, requestedTracks)) },
  // The compiled decoder's list. One track in the seed is a `.wma`, so the
  // unplayable badge is reachable in the preview.
  playable_extensions: ["mp3", "flac", "m4a", "m4b", "mp4", "aac", "ogg", "oga", "wav", "wave", "aiff", "aif", "aifc"],
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
  // @tauri-apps/api v2 routes `unlisten` through this internals object rather
  // than an IPC call; without it every effect cleanup rejects in the console.
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
      // No browser to hand off to; the walkthrough's link rows still exercise
      // their own path.
      if (cmd.startsWith("plugin:opener|")) return null;
      if (cmd === "set_api_key") {
        const key = apiKeys.find((k) => k.name === payload?.name);
        if (key) key.configured = String(payload?.value ?? "").trim() !== "";
        if (key?.name === "acoustid") onboarding.acoustidConfigured = key.configured;
        return key;
      }
      // The OS picker, standing in for a choice that cannot be made in a
      // browser. A folder request gets the import folder; a file request is the
      // cover picker, and gets a stand-in image path.
      if (cmd === "plugin:dialog|open") {
        const options = payload?.options as { directory?: boolean } | undefined;
        return options?.directory ? MOCK_IMPORT_FOLDER : "/Users/dev/Pictures/discovery-scan.jpg";
      }
      // The picked image, admitted for preview. Landscape on purpose, so the
      // reframe slider — the modal's one real control — is exercised.
      if (cmd === "allow_cover_preview") {
        return { path: thumb("#0ea5e9", "#164e63"), bytes: 4_600_000 };
      }
      // The cover the album already wears, reopened for a tighter frame. Square
      // here, the way a real archive is — the point being to check that the
      // stage receives it, not the aspect ratio it arrives in.
      if (cmd === "album_recrop_source") {
        return { path: thumb("#f472b6", "#7c3aed"), bytes: 3_100_000 };
      }
      // The Cover Art Archive's uploads for a release: three plausible scans,
      // front first, after a network-ish delay. `?nocandidates` previews the
      // empty state, `?candidatesfail` the error one.
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
      // A pasted link: pretend the download landed in a temp file. Adoption
      // then goes through allow_cover_preview, which serves the stand-in.
      if (cmd === "fetch_artist_image_url") {
        await new Promise((resolve) => window.setTimeout(resolve, 600));
        if (new URLSearchParams(window.location.search).has("urlfail")) throw new Error("not an image");
        return { path: "/tmp/mock-fetched.jpg", bytes: 2_400_000 };
      }
      // The clipboard path: a browser cannot serve the OS pasteboard, so the
      // image read refuses and the text read hands back a copied image address
      // — which exercises the whole clipboard→link→adopt chain above.
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
      // What the Settings pane shows as the installed version. A browser has no
      // bundle to read one from. Kept equal to the `currentVersion` the check
      // below reports, so `?update` previews a coherent 0.8.0 → 0.9.0 and not a
      // downgrade.
      if (cmd === "plugin:app|version") return "0.8.0";
      // Opt-in: an update prompt on every preview would sit over whatever is
      // being looked at. `?update` is how you go and look at it on purpose.
      // The body is a faithful release-please changelog with the hand-written
      // `En bref` section on top — the exact shape `parseReleaseNotes` is fed
      // in production, so `?update` previews the notes modal too.
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
        // Mirrors the backend: one slice of the whole archive plus the totals
        // the history page paginates on.
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
      // Mirrors `JobsState::target_albums`: the destinations of whatever is
      // still moving, which is what the library's delete guard reads.
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
        // The real check spawns Python and imports beets: a second or two, and
        // the whole reason there is a splash at all. The mock answers in the
        // same tick, so the splash and its hand-over flash past unseen —
        // `?splash` (optionally `?splash=3000`) holds the answer back long
        // enough to look at them.
        const held = new URLSearchParams(window.location.search).get("splash");
        if (held !== null) await new Promise((resolve) => window.setTimeout(resolve, Number(held) || 2000));
        return { ...env };
      }
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
      // One of each verdict, so the panel's three registers are all reachable
      // without waiting for a real service to fall over.
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
      // A plausible move, across volumes so the confirmation's slower branch is
      // the one on screen; picking a folder under /Users/preview shows a
      // refusal instead.
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
          category: (payload?.category as string | null) ?? null,
          forcedAlbum: (payload?.forcedAlbum as unknown) ?? null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        jobs.unshift(queued);
        return queued;
      }
      // One sweep for both archives, as the Rust command does: terminal jobs
      // out, the imports emptied wholesale, in-flight rows untouched.
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
      // The undo pair reads/mutates the seed like the Rust pair reads the
      // store, so the flow is walkable in the preview: preview counts, undo
      // stamps the row and the invalidation re-lists it.
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
      // Same in-memory seed, so declaring a collection actually silences the
      // missing-track line on the metadata page rather than only redrawing the
      // switch. Written on every track of the album, which is where the real
      // listing surfaces the album row's own attribute.
      if (cmd === "set_album_kind") {
        const ids = new Set((payload?.albumIds as number[]) ?? []);
        const kind = payload?.kind === "collection" ? "collection" : null;
        // The already-built listing, like `set_album_cover`: `list_library`'s
        // rows are copies made once at module load, so writing to the seed
        // behind them would change nothing anyone reads.
        const { tracks } = responses.list_library as { tracks: { album_id: number; album_kind?: string | null }[] };
        let updated = 0;
        for (const track of tracks) {
          if (!ids.has(track.album_id)) continue;
          track.album_kind = kind;
          updated += 1;
        }
        return { updated };
      }
      // The classify verb, on the same built listing: every track carrying the
      // genre gets rebucketed, so the shelves reorganize in the browser. The
      // base bucket is remembered at first override — that is what "original
      // placement" restores.
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
      // The move verb, on the same built listing: tracks re-filed onto the
      // target row (or a fresh one), numbered onward when asked — so both
      // pickers, the kind proposal and the undo toast all run in the browser.
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
      // Answered checks, on the same built listing as `set_album_kind`: the
      // point of the mock here is that accepting really does close the line.
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
      // Re-match: a slow yes, so the album loop's progress bar and its Stop
      // button are observable here (the real call is a network round-trip).
      if (cmd === "reenrich_track") {
        return new Promise((resolve) => window.setTimeout(() => resolve({ matched: true }), 1200));
      }
      // The Rust engine owns playback, so a browser preview has none. A fake
      // playhead is what keeps the player bar, the seek bar and the queue panel
      // explorable here: without it nothing ever advances and "playing" is a
      // state the UI can never be seen in.
      if (cmd === "fetch_lyrics") return mockLyrics(payload);
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
    // Past `CROWDED_FOLDER`, so the preview shows the suggestion doing its job.
    largestFolder: 214,
    // The archive knows this folder: the preview shows the re-import notice,
    // in its stopped flavour — the one that matters now that imports can be
    // stopped.
    previouslyImported: { folder: path, finishedAt: now - 86_400_000, cancelled: true },
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

/** The scan's counts as the archive keeps them — the subset a finished import
 * can still be asked about. */
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

/**
 * Two runs already in the archive, so the History page has both verdicts on it
 * before anything is imported in the preview. The older one failed: the row that
 * says an import stopped is the one nobody thinks to look at.
 */
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

/** Armed by `cancel_library_import`, consumed by the next copy tick — the
 * same file-on-disk handshake the real sidecar uses, minus the disk. */
let mockImportCancelRequested = false;

/**
 * An import that takes visible time.
 *
 * Instant would hide the one state worth previewing. `?failImport` stops it
 * partway instead — the failure has to be drawable too, and it is the state
 * nobody thinks to look at. The stop button works for real: it arms the flag
 * above, and the copy loop breaks on the next tick, exactly one album late,
 * like the real watchdog's half-second.
 */
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

  // The cover pass that follows the copy: a second count of different things,
  // which the bar has to restart for rather than crawl the last inch. On a
  // cancel it still runs — over what landed, like the real pass.
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
    // Archived alongside the result, as the backend does: the row has to be
    // able to say what it was asked for.
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
  // The archive gains a row the moment an import ends, exactly as the backend
  // does it — so the History page has something to show after a preview import.
  mockImports.unshift(record);

  return { folders: record.folders, renditions: record.renditions, recap: record.recap, cancelled };
}

/** What one archived run still has in the library, read off its own recap —
 * the real preview counts the library, but the mock has no library to count. */
function mockUndoPreview(id: string): unknown {
  const record = mockImports.find((row) => (row as { id: string }).id === id) as
    { recap: { tracks: number; albums: number } | null } | undefined;
  const tracks = record?.recap?.tracks ?? 0;
  const albums = record?.recap?.albums ?? 0;
  return {
    tracks,
    // One album of the run kept, so the preview shows the sentence nobody
    // expects — the import had added to a record already on the shelf.
    albumsRemoved: Math.max(0, albums - 1),
    albumsKept: albums > 0 ? 1 : 0,
    playlistEntries: tracks > 0 ? 3 : 0,
  };
}

/** Stamp the row undone, as the backend does. The archive keeps it: a run that
 * was taken back out is two things that happened. */
function mockUndo(id: string): unknown {
  const record = mockImports.find((row) => (row as { id: string }).id === id) as
    { undoneAt?: number; recap: { tracks: number } | null } | undefined;
  if (!record) return { removed: 0, foreign: 0, playlistEntries: 0 };
  record.undoneAt = Date.now();
  return { removed: record.recap?.tracks ?? 0, foreign: 0, playlistEntries: 3 };
}

/** The align pass, at preview pace: a few progress ticks, then a small plan
 * naming real fixture albums so the verdict list has something to say. */
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
 * Lyrics for the player's panel.
 *
 * The words are invented placeholders, not any real song's: this file ships in
 * the repo. What the fixture reproduces is the *shape* of each answer — timed,
 * plain, instrumental, absent — because that is what the panel branches on.
 *
 * Ids map to the library fixture above: 100 already has its lyrics stored (the
 * panel fills the moment it opens), 101 and 102 have none until the button is
 * pressed, and 200 is the instrumental.
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
    // Long enough to overflow the panel, which is the point: a song of seven
    // lines would never exercise the scroll that follows the playhead.
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

  // The wait is the point: it is what the button's disabled state is for.
  await new Promise((resolve) => window.setTimeout(resolve, 900));
  if (id === 100) return answer({ source: "lrclib", plain: "Placeholder verse, first line", lines: mockLyricLines(6) });
  if (id === 101) return answer({ source: "lrclib", plain: "Placeholder verse, first line", lines: mockLyricLines(4) });
  // 102 is the upgrade path: plain text from the fallback until "look again"
  // reaches an LRCLIB that has come back, and the same page arrives timed.
  if (id === 102)
    return force
      ? answer({ source: "lrclib", plain: plainBody, lines: mockLyricLines(5) })
      : answer({ source: "lyrics.ovh", plain: plainBody });
  // 103 is LRCLIB having a bad day — it accepts the connection and never
  // answers, which is the failure this feature actually meets in the wild.
  if (id === 103) return answer({ unreachable: true });
  if (id === 200) return answer({ source: "lrclib", instrumental: true });
  return answer();
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
