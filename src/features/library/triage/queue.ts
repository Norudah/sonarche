import { triagePaths } from "@/app/paths";
import type { Album } from "@/features/library/albums/albums";
import type { Artist } from "@/features/library/artists/artists";
import { hasTracklistGaps } from "@/features/library/albums/triage";
import type { AcceptedCheck, LibraryTrack } from "@/features/library/api";
import {
  applyTrackTriage,
  duplicateRecordingTracks,
  GENRE_MISSING,
  GENRE_OFF_TREE,
  NO_TRIAGE,
} from "@/features/library/tracks/triage";

/** A clickable count leading to the filtered explorer. */
export interface TriageDoor {
  key: DoorKey;
  count: number;
  /** Per door, since the genre line fuses "no genre" and "off tree". */
  subjects: string[];
  /** The `triagePaths` deep link. */
  to: string;
}

export type DoorKey =
  | "missingYear"
  | "missingTrackNumber"
  | "genreMissing"
  | "genreOffTree"
  | "missingArtwork"
  | "tracklistGaps"
  | "suspectMatch"
  | "duplicateRecording"
  | "artistImageMissing";

/** One queue row. The genre row fuses two doors; zero doors are dropped, and a
 * row counting zero is hidden. */
export interface TriageLine {
  key: "year" | "track" | "genre" | "artwork" | "tracklist" | "suspect" | "duplicates" | "artistImage";
  count: number;
  doors: TriageDoor[];
  /** A few track or album titles. */
  examples: string[];
  /** Everything the line names, so the headline counts each thing once. */
  subjects: string[];
  /** Null when the line can't be accepted (see `AcceptedCheck`). */
  accept: AcceptTarget | null;
}

/** Item ids for track checks, album row ids for album checks (every row of a card). */
export interface AcceptTarget {
  scope: "track" | "album";
  check: AcceptedCheck;
  ids: number[];
}

/** Distinct things to complete, counted once each and split by kind (summing
 * lines double-counted tracks). */
export interface TriageTally {
  tracks: number;
  albums: number;
  total: number;
}

const EXAMPLE_COUNT = 3;

/** Prefixed so track ids and album keys never collide. */
function trackSubject(track: LibraryTrack): string {
  return `t:${track.id}`;
}

function albumSubject(album: Album): string {
  return `a:${album.key}`;
}

/** Untitled items stay counted but aren't listed. */
function examplesOf(titles: string[]): string[] {
  return titles.filter((title) => title.trim() !== "").slice(0, EXAMPLE_COUNT);
}

function doorsOf(doors: TriageDoor[]): { count: number; doors: TriageDoor[]; subjects: string[] } {
  const open = doors.filter((door) => door.count > 0);
  return {
    count: open.reduce((sum, door) => sum + door.count, 0),
    doors: open,
    subjects: open.flatMap((door) => door.subjects),
  };
}

function trackDoor(key: DoorKey, tracks: LibraryTrack[], to: string): TriageDoor {
  return { key, count: tracks.length, subjects: tracks.map(trackSubject), to };
}

function albumDoor(key: DoorKey, albums: Album[], to: string): TriageDoor {
  return { key, count: albums.length, subjects: albums.map(albumSubject), to };
}

function trackTarget(check: AcceptedCheck, tracks: LibraryTrack[]): AcceptTarget {
  return { scope: "track", check, ids: tracks.map((track) => track.id) };
}

/** Every beets row behind a card. */
function albumTarget(check: AcceptedCheck, albums: Album[]): AcceptTarget {
  return { scope: "album", check, ids: albums.flatMap((album) => album.albumIds) };
}

/** The correction queue, from the same predicates the explorers filter with,
 * so each door opens on exactly the count it shows. */
export function buildTriageQueue(tracks: LibraryTrack[], albums: Album[]): TriageLine[] {
  const missingYear = applyTrackTriage(tracks, { ...NO_TRIAGE, missingYear: true });
  const missingTrackNumber = applyTrackTriage(tracks, { ...NO_TRIAGE, missingTrackNumber: true });
  const genreMissing = applyTrackTriage(tracks, { ...NO_TRIAGE, genre: GENRE_MISSING });
  const genreOffTree = applyTrackTriage(tracks, { ...NO_TRIAGE, genre: GENRE_OFF_TREE });
  const suspect = tracks.filter((track) => track.suspectMatch);
  // Filtered after detection: dropping one copy first would unflag its twin.
  const duplicated = duplicateRecordingTracks(tracks).filter((track) => !track.accepted.includes("duplicates"));
  const missingArtwork = albums.filter((album) => album.artUrl == null && !album.accepted.includes("artwork"));
  const gapped = albums.filter(hasTracklistGaps);

  return [
    {
      key: "suspect",
      ...doorsOf([trackDoor("suspectMatch", suspect, triagePaths.suspectMatch)]),
      examples: examplesOf(suspect.map((track) => track.title)),
      // A suspect match needs a look, not an acceptance.
      accept: null,
    },
    {
      key: "duplicates",
      ...doorsOf([trackDoor("duplicateRecording", duplicated, triagePaths.duplicateRecording)]),
      examples: examplesOf(duplicated.map((track) => track.title)),
      accept: trackTarget("duplicates", duplicated),
    },
    {
      key: "year",
      ...doorsOf([trackDoor("missingYear", missingYear, triagePaths.missingYear)]),
      examples: examplesOf(missingYear.map((track) => track.title)),
      accept: trackTarget("year", missingYear),
    },
    {
      key: "track",
      ...doorsOf([trackDoor("missingTrackNumber", missingTrackNumber, triagePaths.missingTrackNumber)]),
      examples: examplesOf(missingTrackNumber.map((track) => track.title)),
      accept: trackTarget("track", missingTrackNumber),
    },
    {
      key: "genre",
      ...doorsOf([
        trackDoor("genreMissing", genreMissing, triagePaths.genreMissing),
        trackDoor("genreOffTree", genreOffTree, triagePaths.genreOffTree),
      ]),
      examples: examplesOf([...genreMissing, ...genreOffTree].map((track) => track.title)),
      accept: trackTarget("genre", [...genreMissing, ...genreOffTree]),
    },
    {
      key: "artwork",
      ...doorsOf([albumDoor("missingArtwork", missingArtwork, triagePaths.missingArtwork)]),
      examples: examplesOf(missingArtwork.map((album) => album.title)),
      accept: albumTarget("artwork", missingArtwork),
    },
    {
      key: "tracklist",
      ...doorsOf([albumDoor("tracklistGaps", gapped, triagePaths.tracklistGaps)]),
      examples: examplesOf(gapped.map((album) => album.title)),
      // A record without a tracklist is a collection instead.
      accept: null,
    },
  ];
}

/** App-side gaps (artist images), kept out of the metadata tally and badge.
 * Empty while the image map loads. */
export function buildSystemQueue(artists: Artist[], images: ReadonlyMap<string, string> | undefined): TriageLine[] {
  if (images == null) return [];
  const missing = artists.filter((artist) => !images.has(artist.name));
  return [
    {
      key: "artistImage",
      count: missing.length,
      doors:
        missing.length > 0
          ? [
              {
                key: "artistImageMissing",
                count: missing.length,
                subjects: missing.map((artist) => `ar:${artist.name}`),
                to: triagePaths.artistImageMissing,
              },
            ]
          : [],
      examples: examplesOf(missing.map((artist) => artist.name)),
      subjects: missing.map((artist) => `ar:${artist.name}`),
      // No beets row to store an acceptance; the checks menu disables it instead.
      accept: null,
    },
  ];
}

/** Accepted objects per check, so answers can be reviewed and undone. */
export function acceptedTargets(tracks: LibraryTrack[], albums: Album[]): AcceptTarget[] {
  const targets: AcceptTarget[] = [];
  for (const check of ["year", "track", "genre", "duplicates"] as const) {
    const answered = tracks.filter((track) => track.accepted.includes(check));
    if (answered.length > 0) targets.push(trackTarget(check, answered));
  }
  const artwork = albums.filter((album) => album.accepted.includes("artwork"));
  if (artwork.length > 0) targets.push(albumTarget("artwork", artwork));
  return targets;
}

/** Distinct things to complete, by kind. Zero is the win state. */
export function tallyToFix(queue: TriageLine[]): TriageTally {
  const subjects = new Set<string>();
  for (const line of queue) for (const subject of line.subjects) subjects.add(subject);

  let tracks = 0;
  for (const subject of subjects) if (subject.startsWith("t:")) tracks += 1;

  return { tracks, albums: subjects.size - tracks, total: subjects.size };
}
