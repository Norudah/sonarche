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
  /** Folders holding at least one audio file — the progress denominator, since
   * beets imports a tree folder by folder and names each one as it goes. */
  albumFolders: number;
  /** Total bytes of every audio file found. */
  bytes: number;
  /** The walk hit its ceiling: every count above is a floor. */
  truncated: boolean;
}

export function scanImportFolder(path: string): Promise<ScanReport> {
  return invoke<ScanReport>("scan_import_folder", { path });
}

/** What the import did, once it is over. */
export interface ImportOutcome {
  /** Album folders beets took on — comparable to the scan's `albumFolders`. */
  folders: number;
}

/** Copy a folder's music into the library. Resolves when beets is done, which
 * on a real collection is minutes away. */
export function startLibraryImport(folder: string): Promise<ImportOutcome> {
  return invoke<ImportOutcome>("start_library_import", { folder });
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
