/** The import page's state as one discriminated union, derived from two
 * mutations and the chosen folder. */

import type { ImportOutcome, ScanReport } from "@/features/import/api";

export type ImportPhase =
  | { kind: "empty" }
  | { kind: "scanning" }
  | { kind: "scanFailed"; message: string }
  | { kind: "scanned"; report: ScanReport }
  | { kind: "importing"; report: ScanReport }
  /** The report is kept for the recap (bytes, undecodable files). */
  | { kind: "imported"; outcome: ImportOutcome; report: ScanReport | null }
  /** Stopped by the user; what landed is in the library. */
  | { kind: "importCancelled"; outcome: ImportOutcome; report: ScanReport | null }
  /** The report is kept so a retry needs no rescan. */
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

  // Import states win over a stale scan result.
  if (importing && report != null) return { kind: "importing", report };
  if (outcome != null) {
    return outcome.cancelled ? { kind: "importCancelled", outcome, report } : { kind: "imported", outcome, report };
  }
  if (importError != null && report != null) return { kind: "importFailed", message: importError, report };

  // Whichever mutation reported last is current.
  if (scanning) return { kind: "scanning" };
  if (scanError != null) return { kind: "scanFailed", message: scanError };
  if (report != null) return { kind: "scanned", report };

  // Chosen, scan not reporting yet.
  return { kind: "scanning" };
}
