import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface ScanReport {
  playable: number;
  /** Audio the engine can't decode; still imported. */
  unplayable: number;
  /** Lowercase, no dot. */
  unplayableByExtension: Record<string, number>;
  unplayableExamples: string[];
  /** Folders with audio: the progress denominator (beets reports per folder). */
  albumFolders: number;
  /** Audio files in the fullest folder; see `suggestGrouping`. */
  largestFolder: number;
  bytes: number;
  /** Hit the walk limit: counts are floors. */
  truncated: boolean;
  /** An earlier import of the same ground; beets will skip what it has seen. */
  previouslyImported?: PreviousImport;
}

export interface PreviousImport {
  folder: string;
  finishedAt: number;
  /** Stopped: part of the folder is in, relaunching finishes it. */
  cancelled: boolean;
}

export function scanImportFolder(path: string): Promise<ScanReport> {
  return invoke<ScanReport>("scan_import_folder", { path });
}

/** Tag quality of an import, counted by `sidecar/import_recap.py`. Null when
 * the sidecar couldn't account for the run (not the same as importing nothing). */
export interface ImportRecap {
  tracks: number;
  albums: number;
  withoutYear: number;
  withoutGenre: number;
  /** Genres not on Sonarche's tree. */
  offTree: number;
  albumsWithoutArt: number;
  albumsWithGaps: number;
  /** Rows filed as collections (`sidecar/auto_collection.py`); absent on older runs. */
  collections?: number;
}

export interface ImportOutcome {
  /** Comparable to the scan's `albumFolders`. */
  folders: number;
  /** Oversized covers scaled down in place. */
  renditions: number;
  recap: ImportRecap | null;
  /** Stopped by the user; what was copied is in the library. */
  cancelled: boolean;
}

/** The scan counts the archive keeps (the report itself isn't stored). */
export interface ImportScanCounts {
  playable: number;
  unplayable: number;
  unplayableByExtension: Record<string, number>;
  bytes: number;
  albumFolders: number;
}

/** One finished import. Written once at the end, hence no `running` status. */
export interface ImportRecord {
  id: string;
  folder: string;
  status: "done" | "failed" | "cancelled";
  error: string | null;
  scan: ImportScanCounts;
  folders: number;
  renditions: number;
  /** Absent on runs archived before import options existed. */
  grouping?: Grouping;
  category?: string | null;
  recap: ImportRecap | null;
  /** Epoch ms; null while the run stands. */
  undoneAt?: number | null;
  /** Epoch ms. */
  finishedAt: number;
}

export function listImports(): Promise<ImportRecord[]> {
  return invoke<ImportRecord[]>("list_imports");
}

/** Counted from the current library, not the run's recap. */
export interface ImportUndoPreview {
  tracks: number;
  albumsRemoved: number;
  /** Albums that only lose some tracks. */
  albumsKept: number;
  playlistEntries: number;
}

export interface ImportUndoOutcome {
  removed: number;
  /** Rows dropped while their file, outside the library, was left on disk. */
  foreign: number;
  playlistEntries: number;
}

export function previewImportUndo(id: string): Promise<ImportUndoPreview> {
  return invoke<ImportUndoPreview>("preview_import_undo", { id });
}

/** Removes one import's tracks, files, emptied albums, covers, playlist
 * entries and beets' memory of the folder. */
export function undoImport(id: string): Promise<ImportUndoOutcome> {
  return invoke<ImportUndoOutcome>("undo_import", { id });
}

/**
 * How the import decides what an album is (beets makes one per directory):
 * - `folder`: one directory = one album.
 * - `tags`: regroup each directory by album tag.
 * - `tracks`: no albums, every file is a singleton.
 */
export type Grouping = "folder" | "tags" | "tracks";

/** Resolves when beets finishes (minutes on a real collection). */
export function startLibraryImport(
  folder: string,
  grouping: Grouping,
  category: string | null,
): Promise<ImportOutcome> {
  return invoke<ImportOutcome>("start_library_import", { folder, grouping, category });
}

/** Fire-and-forget: the import call resolves as cancelled once beets stops. */
export function cancelLibraryImport(): Promise<void> {
  return invoke<void>("cancel_library_import");
}

/** Resolves to null when the user closes the picker. Multiple selection is
 * off, so the array case is impossible. */
export async function pickFolder(): Promise<string | null> {
  const chosen = await open({ directory: true, multiple: false });
  return typeof chosen === "string" ? chosen : null;
}
