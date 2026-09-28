import type { ParseKeys } from "i18next";

import type { DoorKey } from "@/features/library/triage/queue";

/** Short tooltip labels for track-level doors. Album-level doors
 * (`missingArtwork`, `tracklistGaps`) have none. */
export const ATTENTION_LABEL: Partial<Record<DoorKey, ParseKeys<"library">>> = {
  suspectMatch: "albums.attention.suspectMatch",
  duplicateRecording: "albums.attention.duplicateRecording",
  missingYear: "albums.attention.missingYear",
  missingTrackNumber: "albums.attention.missingTrackNumber",
  genreMissing: "albums.attention.genreMissing",
  genreOffTree: "albums.attention.genreOffTree",
};
