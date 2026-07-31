/**
 * Where the import has got to, as one value.
 *
 * The page holds two mutations and a chosen folder, which between them can be
 * in seven states; deriving them in the markup meant a stack of booleans where
 * every new one had to be read against all the others to know what was on
 * screen. Naming the states makes the card a function of one argument, and
 * makes the impossible ones — a summary while the scan is still running, a
 * progress bar with nothing to count against — unrepresentable.
 */

import type { ImportOutcome, ScanReport } from "@/features/import/api";

export type ImportPhase =
  /** No folder chosen yet. */
  | { kind: "empty" }
  | { kind: "scanning" }
  | { kind: "scanFailed"; message: string }
  /** Scanned, waiting on the user. */
  | { kind: "scanned"; report: ScanReport }
  | { kind: "importing"; report: ScanReport }
  /** Done. The report comes along because the recap is about the two together —
   * what the folder held (bytes, what could not be decoded) and what became of
   * it. Absent only if an outcome somehow arrived without a scan preceding it,
   * which the page cannot produce. */
  | { kind: "imported"; outcome: ImportOutcome; report: ScanReport | null }
  /** Failed mid-copy. The report is kept so the card can still say what the
   * folder held, and so trying again does not need a second scan. */
  | { kind: "importFailed"; message: string; report: ScanReport };

export interface PhaseInput {
  folder: string | null;
  scanning: boolean;
  scanError: string | null;
  report: ScanReport | null;
  importing: boolean;
  importError: string | null;
  outcome: ImportOutcome | null;
}

export function importPhase(input: PhaseInput): ImportPhase {
  const { folder, scanning, scanError, report, importing, importError, outcome } = input;

  if (folder == null) return { kind: "empty" };

  // The import's own states come first: once it has run, a stale scan result
  // sitting beside it is not what the screen is about any more.
  if (importing && report != null) return { kind: "importing", report };
  if (outcome != null) return { kind: "imported", outcome, report };
  if (importError != null && report != null) return { kind: "importFailed", message: importError, report };

  // A fresh scan overrides an older one's failure, and vice versa — whichever
  // the mutation last reported is the truth about this folder.
  if (scanning) return { kind: "scanning" };
  if (scanError != null) return { kind: "scanFailed", message: scanError };
  if (report != null) return { kind: "scanned", report };

  // Chosen, and the scan has not started reporting yet.
  return { kind: "scanning" };
}
