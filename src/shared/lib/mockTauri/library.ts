/** The library listing and its edits: metadata, moves, kinds, genres, accepted checks. */

import type { Handler } from "./types";
import { isEmpty, thumb } from "./fixtures";

/** The one undecodable (Opus) fixture, so the unplayable state is clickable. */
const UNPLAYABLE_TITLE = "Wait";

/** Mirrors `src-tauri/src/audio_formats.rs`. */
export function isPlayablePath(path: string): boolean {
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

// Placements, plus each genre's original bucket so reset can restore it.
const mockGenreOverrides = new Map<string, string>();

const mockBaseBuckets = new Map<string, string | null>();

/** The built listing; handlers edit these rows so re-lists reflect the edits. */
export const library = { tracks: isEmpty ? [] : withAlbumIds(inflate(libraryTracks, requestedTracks)) };

export const handlers: Record<string, Handler> = {
  // Write to the seed so a re-list reflects the edit.
  update_tracks: (payload) => {
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
  },
  set_album_kind: (payload) => {
    const ids = new Set((payload?.albumIds as number[]) ?? []);
    const kind = payload?.kind === "collection" ? "collection" : null;
    // `list_library`'s rows are copies made at load: write to those.
    const { tracks } = library as { tracks: { album_id: number; album_kind?: string | null }[] };
    let updated = 0;
    for (const track of tracks) {
      if (!ids.has(track.album_id)) continue;
      track.album_kind = kind;
      updated += 1;
    }
    return { updated };
  },
  // Rebuckets every track with the genre; the original bucket is remembered
  // for reset.
  set_genre_family: (payload) => {
    const genre = String(payload?.genre ?? "").trim();
    const family = (payload?.family as string | null) ?? null;
    const key = genre.toLowerCase();
    const { tracks } = library as {
      tracks: { genre: string | null; genre_bucket: string | null }[];
    };
    const matching = tracks.filter((track) => (track.genre ?? "").toLowerCase() === key);
    if (!mockBaseBuckets.has(key)) mockBaseBuckets.set(key, matching[0]?.genre_bucket ?? null);
    const target = family ?? mockBaseBuckets.get(key) ?? null;
    for (const track of matching) track.genre_bucket = target;
    if (family == null || family === mockBaseBuckets.get(key)) mockGenreOverrides.delete(key);
    else mockGenreOverrides.set(key, family);
    return { genre, family: target, overridden: mockGenreOverrides.has(key) };
  },
  list_genre_overrides: () => {
    return { overrides: [...mockGenreOverrides].map(([genre, family]) => ({ genre, family })) };
  },
  move_tracks: async (payload) => {
    const spec = payload?.spec as {
      itemIds: number[];
      targetAlbumId?: number;
      newAlbum?: { album: string; albumartist: string };
      kind?: string;
      renumber?: boolean;
    };
    const { tracks } = library as { tracks: Record<string, unknown>[] };
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
  },
  set_check_accepted: (payload) => {
    const ids = new Set((payload?.ids as number[]) ?? []);
    const check = String(payload?.check);
    const on = Boolean(payload?.accepted);
    const isAlbum = payload?.scope === "album";
    const scope = isAlbum ? "album_accepted" : "accepted";
    const { tracks } = library as { tracks: Record<string, unknown>[] };
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
  },
  // Slow, so the album loop's progress and Stop button can be seen.
  reenrich_track: () => {
    return new Promise((resolve) => window.setTimeout(() => resolve({ matched: true }), 1200));
  },
  list_library: () => library,
  remux_library: () => ({ scanned: 0, fragmented: 0, remuxed: 0, failed: [] }),
  // One seed track is `.wma`, so the unplayable badge is reachable.
  playable_extensions: () => [
    "mp3",
    "flac",
    "m4a",
    "m4b",
    "mp4",
    "aac",
    "ogg",
    "oga",
    "wav",
    "wave",
    "aiff",
    "aif",
    "aifc",
  ],
};
