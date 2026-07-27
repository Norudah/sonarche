import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

/** What a folder holds, as the backend counted it. */
export interface ScanReport {
  /** Files the engine can decode. */
  playable: number;
  /** Audio files it cannot. Still imported — see the import doctrine. */
  unplayable: number;
  /** Counts by extension, lowercase and undotted. */
  unplayableByExtension: Record<string, number>;
  /** A few of them by name, so the screen can show rather than assert. */
  unplayableExamples: string[];
  /** Total bytes of every audio file found. */
  bytes: number;
  /** The walk hit its ceiling: every count above is a floor. */
  truncated: boolean;
}

export function scanImportFolder(path: string): Promise<ScanReport> {
  return invoke<ScanReport>("scan_import_folder", { path });
}

/**
 * Ask the OS for a folder. Resolves to null when the user closes the panel,
 * which is an answer and not a failure.
 *
 * `open` can return an array when multiple selection is on; it is not, so the
 * array case is impossible — narrowed rather than handled.
 */
export async function pickFolder(): Promise<string | null> {
  const chosen = await open({ directory: true, multiple: false });
  return typeof chosen === "string" ? chosen : null;
}
