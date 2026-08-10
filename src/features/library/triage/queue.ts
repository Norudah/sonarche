import { triagePaths } from "@/app/paths";
import type { Album } from "@/features/library/albums/albums";
import { hasTracklistGaps } from "@/features/library/albums/triage";
import type { AcceptedCheck, LibraryTrack } from "@/features/library/api";
import {
  applyTrackTriage,
  duplicateRecordingTracks,
  GENRE_MISSING,
  GENRE_OFF_TREE,
  NO_TRIAGE,
} from "@/features/library/tracks/triage";

/** One clickable count — the page's doctrine is that every number is a door
 * into the filtered explorer, never a figure to just look at. */
export interface TriageDoor {
  key:
    | "missingYear"
    | "genreMissing"
    | "genreOffTree"
    | "missingArtwork"
    | "tracklistGaps"
    | "suspectMatch"
    | "duplicateRecording";
  count: number;
  /** The matching `triagePaths` deep link. */
  to: string;
}

/** One row of the correction queue. The genre row fuses two doors — missing
 * and off-tree are fixed in the same editor — every other row carries one.
 * Doors that count zero are dropped; a row whose doors all dropped counts
 * zero and is the view's cue to hide it. */
export interface TriageLine {
  key: "year" | "genre" | "artwork" | "tracklist" | "suspect" | "duplicates";
  count: number;
  doors: TriageDoor[];
  /** A few concrete names (track or album titles), untranslated data. */
  examples: string[];
  /** Every thing this line points at, by `subject` identity — what the
   * headline counts once even when several lines name the same track. */
  subjects: string[];
  /** What "c'est voulu" would answer here, or null for a line that cannot be
   * answered that way (see `AcceptedCheck`). */
  accept: AcceptTarget | null;
}

/** One batch the accept command can be handed: a scope, a check, and the ids
 * it applies to. Ids are beets' own — item ids for a track check, album row
 * ids for an album one, which is why a card contributes all of its rows. */
export interface AcceptTarget {
  scope: "track" | "album";
  check: AcceptedCheck;
  ids: number[];
}

/** What the page and the sidebar badge announce: things, counted once each.
 *
 * Adding the lines up was inflating the number badly. A track with neither year
 * nor genre landed on two lines and was owned twice, and album lines were
 * summed into the same total as track lines — a real 48-track import scored 64,
 * so the app claimed more defects than the user had music. */
export interface TriageTally {
  tracks: number;
  albums: number;
  total: number;
}

const EXAMPLE_COUNT = 3;

/** Prefixed so the two namespaces can never collide inside the union: a track
 * id and an album key are both strings, and counting a coincidence as one
 * object would understate the total. */
function trackSubject(track: LibraryTrack): string {
  return `t:${track.id}`;
}

function albumSubject(album: Album): string {
  return `a:${album.key}`;
}

/** Untitled items would surface as blank fragments, so they drop out of the
 * examples — they are still in the count and behind the door. */
function examplesOf(titles: string[]): string[] {
  return titles.filter((title) => title.trim() !== "").slice(0, EXAMPLE_COUNT);
}

function doorsOf(doors: TriageDoor[]): { count: number; doors: TriageDoor[] } {
  const open = doors.filter((door) => door.count > 0);
  return { count: open.reduce((sum, door) => sum + door.count, 0), doors: open };
}

function trackTarget(check: AcceptedCheck, tracks: LibraryTrack[]): AcceptTarget {
  return { scope: "track", check, ids: tracks.map((track) => track.id) };
}

/** A card can stand for several beets albums, so every row behind it goes in —
 * answering for the record has to answer for the whole record. */
function albumTarget(check: AcceptedCheck, albums: Album[]): AcceptTarget {
  return { scope: "album", check, ids: albums.flatMap((album) => album.albumIds) };
}

/**
 * The whole correction queue, derived from the already-loaded library the same
 * way the explorers filter it — counts here and rows there come from the very
 * same predicates, so a door always opens on exactly as many items as it said.
 */
export function buildTriageQueue(tracks: LibraryTrack[], albums: Album[]): TriageLine[] {
  const missingYear = applyTrackTriage(tracks, { ...NO_TRIAGE, missingYear: true });
  const genreMissing = applyTrackTriage(tracks, { ...NO_TRIAGE, genre: GENRE_MISSING });
  const genreOffTree = applyTrackTriage(tracks, { ...NO_TRIAGE, genre: GENRE_OFF_TREE });
  const suspect = tracks.filter((track) => track.suspectMatch);
  // Accepted here rather than inside `duplicateRecordingTracks`: a track is a
  // duplicate only relative to its twin, so dropping one first would clear the
  // other of being one — and answering for one copy would quietly unflag both.
  const duplicated = duplicateRecordingTracks(tracks).filter((track) => !track.accepted.includes("duplicates"));
  const missingArtwork = albums.filter((album) => album.artUrl == null && !album.accepted.includes("artwork"));
  const gapped = albums.filter(hasTracklistGaps);

  return [
    {
      key: "suspect",
      ...doorsOf([{ key: "suspectMatch", count: suspect.length, to: triagePaths.suspectMatch }]),
      examples: examplesOf(suspect.map((track) => track.title)),
      subjects: suspect.map(trackSubject),
      // Not answerable: a flagged match asks what the audio *is*, and the
      // answer is to look at it.
      accept: null,
    },
    {
      key: "duplicates",
      ...doorsOf([{ key: "duplicateRecording", count: duplicated.length, to: triagePaths.duplicateRecording }]),
      examples: examplesOf(duplicated.map((track) => track.title)),
      subjects: duplicated.map(trackSubject),
      accept: trackTarget("duplicates", duplicated),
    },
    {
      key: "year",
      ...doorsOf([{ key: "missingYear", count: missingYear.length, to: triagePaths.missingYear }]),
      examples: examplesOf(missingYear.map((track) => track.title)),
      subjects: missingYear.map(trackSubject),
      accept: trackTarget("year", missingYear),
    },
    {
      key: "genre",
      ...doorsOf([
        { key: "genreMissing", count: genreMissing.length, to: triagePaths.genreMissing },
        { key: "genreOffTree", count: genreOffTree.length, to: triagePaths.genreOffTree },
      ]),
      examples: examplesOf([...genreMissing, ...genreOffTree].map((track) => track.title)),
      subjects: [...genreMissing, ...genreOffTree].map(trackSubject),
      accept: trackTarget("genre", [...genreMissing, ...genreOffTree]),
    },
    {
      key: "artwork",
      ...doorsOf([{ key: "missingArtwork", count: missingArtwork.length, to: triagePaths.missingArtwork }]),
      examples: examplesOf(missingArtwork.map((album) => album.title)),
      subjects: missingArtwork.map(albumSubject),
      accept: albumTarget("artwork", missingArtwork),
    },
    {
      key: "tracklist",
      ...doorsOf([{ key: "tracklistGaps", count: gapped.length, to: triagePaths.tracklistGaps }]),
      examples: examplesOf(gapped.map((album) => album.title)),
      subjects: gapped.map(albumSubject),
      // Not answerable either, and for a happier reason: a record with no
      // tracklist is a collection, which says so once for the whole record.
      accept: null,
    },
  ];
}

/** What has already been answered, per check — the page's way of showing that
 * nothing was thrown away and every answer can be taken back. Only checks with
 * something behind them appear. */
export function acceptedTargets(tracks: LibraryTrack[], albums: Album[]): AcceptTarget[] {
  const targets: AcceptTarget[] = [];
  for (const check of ["year", "genre", "duplicates"] as const) {
    const answered = tracks.filter((track) => track.accepted.includes(check));
    if (answered.length > 0) targets.push(trackTarget(check, answered));
  }
  const artwork = albums.filter((album) => album.accepted.includes("artwork"));
  if (artwork.length > 0) targets.push(albumTarget("artwork", artwork));
  return targets;
}

/** How many distinct things the queue is about, split by kind so the headline
 * can name them ("14 titres et 2 albums") instead of handing over one opaque
 * figure. Zero total is the win state. */
export function tallyToFix(queue: TriageLine[]): TriageTally {
  const subjects = new Set<string>();
  for (const line of queue) for (const subject of line.subjects) subjects.add(subject);

  let tracks = 0;
  for (const subject of subjects) if (subject.startsWith("t:")) tracks += 1;

  return { tracks, albums: subjects.size - tracks, total: subjects.size };
}
