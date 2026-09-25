import type { Grouping, ScanReport } from "@/features/import/api";

/** Beyond this, a folder stops looking like one release (a double album is
 * about thirty tracks). */
export const CROWDED_FOLDER = 30;

/** A suggestion from the folder's shape alone (no tags are read): a folder
 * fuller than any release is probably a pile of singles. */
export function suggestGrouping(report: ScanReport): Grouping {
  return report.largestFolder > CROWDED_FOLDER ? "tracks" : "folder";
}

/** Only a departure from beets' default needs explaining. */
export function isSuggestionNotable(report: ScanReport): boolean {
  return suggestGrouping(report) !== "folder";
}
