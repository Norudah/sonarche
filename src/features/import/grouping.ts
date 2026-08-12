import type { Grouping, ScanReport } from "@/features/import/api";

/** Above this many audio files in one folder, a directory stops looking like a
 * release. Deliberately generous: a double album runs to about thirty tracks,
 * and a box set further still — the point is to catch the folder of two hundred
 * one-shots, not to argue with someone's Wagner. */
export const CROWDED_FOLDER = 30;

/**
 * What the folder's shape suggests, before anyone has read a tag.
 *
 * The scan cannot open files, so this reasons on the only structural evidence
 * there is: how full the fullest folder is. A directory with more tracks in it
 * than any release has is almost certainly a pile, and beets would file that
 * pile as one album named after the folder — which is exactly how a real user's
 * fourteen unrelated one-shots became a single record.
 *
 * A suggestion and nothing more: it preselects, the screen says why, and the
 * user overrules it in one click. Returning `folder` for everything else is not
 * a judgement that the folder is well-formed, only that nothing visible from
 * the outside says otherwise.
 */
export function suggestGrouping(report: ScanReport): Grouping {
  return report.largestFolder > CROWDED_FOLDER ? "tracks" : "folder";
}

/** Whether the screen should explain its suggestion rather than just apply it.
 * Only when it departs from beets' own behaviour — an unremarkable folder needs
 * no defence. */
export function isSuggestionNotable(report: ScanReport): boolean {
  return suggestGrouping(report) !== "folder";
}
