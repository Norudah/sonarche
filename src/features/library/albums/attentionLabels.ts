import type { DoorKey } from "@/features/library/triage/queue";

/**
 * Short names for the doors that can name a *track*, for the tracklist dot's
 * tooltip.
 *
 * One label per door, not per queue line. The Metadata page can afford "Genre
 * manquant ou hors arbre" over a row of counts; a tooltip has to pick, and
 * picking the wrong half is what makes a record whose tracks all carry a genre
 * read as missing every one of them.
 *
 * Partial on purpose: `missingArtwork` and `tracklistGaps` are album-level and
 * never reach a row, so giving them a label here would be inventing a caption
 * nothing can display. A missing key means "nothing to say", not "unknown".
 */
export const ATTENTION_LABEL: Partial<Record<DoorKey, string>> = {
  suspectMatch: "albums.attention.suspectMatch",
  duplicateRecording: "albums.attention.duplicateRecording",
  missingYear: "albums.attention.missingYear",
  missingTrackNumber: "albums.attention.missingTrackNumber",
  genreMissing: "albums.attention.genreMissing",
  genreOffTree: "albums.attention.genreOffTree",
};
