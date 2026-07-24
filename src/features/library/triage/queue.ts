import { triagePaths } from "@/app/paths";
import type { Album } from "@/features/library/albums/albums";
import { hasTracklistGaps } from "@/features/library/albums/triage";
import type { LibraryTrack } from "@/features/library/api";
import {
  applyTrackTriage,
  duplicateRecordingTracks,
  GENRE_MISSING,
  GENRE_OFF_TREE,
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
}

const EXAMPLE_COUNT = 3;

/** Untitled items would surface as blank fragments, so they drop out of the
 * examples — they are still in the count and behind the door. */
function examplesOf(titles: string[]): string[] {
  return titles.filter((title) => title.trim() !== "").slice(0, EXAMPLE_COUNT);
}

function doorsOf(doors: TriageDoor[]): { count: number; doors: TriageDoor[] } {
  const open = doors.filter((door) => door.count > 0);
  return { count: open.reduce((sum, door) => sum + door.count, 0), doors: open };
}

/**
 * The whole correction queue, derived from the already-loaded library the same
 * way the explorers filter it — counts here and rows there come from the very
 * same predicates, so a door always opens on exactly as many items as it said.
 */
export function buildTriageQueue(tracks: LibraryTrack[], albums: Album[]): TriageLine[] {
  const none = { missingYear: false, genre: null, suspectMatch: false, duplicateRecording: false };
  const missingYear = applyTrackTriage(tracks, { ...none, missingYear: true });
  const genreMissing = applyTrackTriage(tracks, { ...none, genre: GENRE_MISSING });
  const genreOffTree = applyTrackTriage(tracks, { ...none, genre: GENRE_OFF_TREE });
  const suspect = tracks.filter((track) => track.suspectMatch);
  const duplicated = duplicateRecordingTracks(tracks);
  const missingArtwork = albums.filter((album) => album.artUrl == null);
  const gapped = albums.filter(hasTracklistGaps);

  return [
    {
      key: "suspect",
      ...doorsOf([{ key: "suspectMatch", count: suspect.length, to: triagePaths.suspectMatch }]),
      examples: examplesOf(suspect.map((track) => track.title)),
    },
    {
      key: "duplicates",
      ...doorsOf([{ key: "duplicateRecording", count: duplicated.length, to: triagePaths.duplicateRecording }]),
      examples: examplesOf(duplicated.map((track) => track.title)),
    },
    {
      key: "year",
      ...doorsOf([{ key: "missingYear", count: missingYear.length, to: triagePaths.missingYear }]),
      examples: examplesOf(missingYear.map((track) => track.title)),
    },
    {
      key: "genre",
      ...doorsOf([
        { key: "genreMissing", count: genreMissing.length, to: triagePaths.genreMissing },
        { key: "genreOffTree", count: genreOffTree.length, to: triagePaths.genreOffTree },
      ]),
      examples: examplesOf([...genreMissing, ...genreOffTree].map((track) => track.title)),
    },
    {
      key: "artwork",
      ...doorsOf([{ key: "missingArtwork", count: missingArtwork.length, to: triagePaths.missingArtwork }]),
      examples: examplesOf(missingArtwork.map((album) => album.title)),
    },
    {
      key: "tracklist",
      ...doorsOf([{ key: "tracklistGaps", count: gapped.length, to: triagePaths.tracklistGaps }]),
      examples: examplesOf(gapped.map((album) => album.title)),
    },
  ];
}

/** The headline number — tracks and albums added together, owned as "N things
 * to fix" rather than a track count. Zero is the win state. */
export function countToFix(queue: TriageLine[]): number {
  return queue.reduce((sum, line) => sum + line.count, 0);
}
