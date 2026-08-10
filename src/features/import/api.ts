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
  /** Audio files in the fullest single folder — the hint behind the suggested
   * grouping. See `suggestGrouping`. */
  largestFolder: number;
  /** Total bytes of every audio file found. */
  bytes: number;
  /** The walk hit its ceiling: every count above is a floor. */
  truncated: boolean;
  /** An earlier import covering the same ground, if the archive knows of one.
   * Not a refusal: beets skips the directories it has already taken on, and
   * this is how the screen says so rather than letting a second run look like
   * a failure. */
  previouslyImported?: PreviousImport;
}

export interface PreviousImport {
  folder: string;
  finishedAt: number;
  /** A stopped run — the case worth naming, since part of the folder is
   * already in and finishing is the obvious next move. */
  cancelled: boolean;
}

export function scanImportFolder(path: string): Promise<ScanReport> {
  return invoke<ScanReport>("scan_import_folder", { path });
}

/**
 * The state of the tags an import brought in, as the sidecar counted them
 * (`sidecar/import_recap.py`) over the items it had just stamped.
 *
 * This is the part worth reading. A library import is deliberately as-is — no
 * MusicBrainz, no AcoustID, no genre lookup — so what lands is exactly what the
 * files already carried, and the interesting question is not "did the copy
 * work" but "is any of this tagged".
 *
 * Null on a record whose run the sidecar could not account for, which is a
 * different fact from a run that brought in nothing.
 */
export interface ImportRecap {
  tracks: number;
  albums: number;
  withoutYear: number;
  withoutGenre: number;
  /** A genre the files carry that is not on Sonarche's tree. */
  offTree: number;
  albumsWithoutArt: number;
  albumsWithGaps: number;
  /** Rows the import filed as collections rather than albums, because their
   * tracks never agreed on being one release (`sidecar/auto_collection.py`).
   * Absent on runs archived before the import made that call. */
  collections?: number;
}

/** What the import did, once it is over. */
export interface ImportOutcome {
  /** Album folders beets took on — comparable to the scan's `albumFolders`. */
  folders: number;
  /** Covers too big to draw that were given a small rendition, the original
   * kept beside them as `cover-hq.*`. */
  renditions: number;
  recap: ImportRecap | null;
  /** The user stopped the copy. Not a failure: everything taken on by then is
   * in the library, and the counts above describe it. */
  cancelled: boolean;
}

/** The scan's counts as the archive keeps them — the report itself is not
 * stored, only the figures a finished import can still be asked about. */
export interface ImportScanCounts {
  playable: number;
  unplayable: number;
  unplayableByExtension: Record<string, number>;
  bytes: number;
  albumFolders: number;
}

/**
 * One finished import, out of the app's own database.
 *
 * Written once, at the end, which is why there is no `running` status: the page
 * driving an import shows it live, and the archive only ever holds runs that
 * ended.
 */
export interface ImportRecord {
  id: string;
  folder: string;
  status: "done" | "failed" | "cancelled";
  error: string | null;
  scan: ImportScanCounts;
  folders: number;
  renditions: number;
  /** What the run was asked to do. Absent on runs archived before the import
   * had options — those were all made under beets' one default behaviour. */
  grouping?: Grouping;
  category?: string | null;
  recap: ImportRecap | null;
  /** When the run was taken back out of the library, epoch milliseconds. Null
   * while it stands — which is every row until someone undoes one. */
  undoneAt?: number | null;
  /** Epoch milliseconds. */
  finishedAt: number;
}

export function listImports(): Promise<ImportRecord[]> {
  return invoke<ImportRecord[]>("list_imports");
}

/**
 * What undoing a run would take away.
 *
 * Counted from the library as it stands now, not from what the run reported
 * when it ended: tracks may have been deleted by hand since, and an album the
 * import merely added to may have grown.
 */
export interface ImportUndoPreview {
  tracks: number;
  /** Albums that disappear with their tracks. */
  albumsRemoved: number;
  /** Albums that only lose some — the import had added to a record that was
   * already there. Its own number because it is the consequence nobody
   * expects. */
  albumsKept: number;
  /** Playlist entries that go with the tracks. */
  playlistEntries: number;
}

export interface ImportUndoOutcome {
  removed: number;
  /** Rows dropped whose file sat outside the library, left on disk. Nothing an
   * import created can be there, so this is only ever a sign something else
   * went wrong earlier. */
  foreign: number;
  playlistEntries: number;
}

export function previewImportUndo(id: string): Promise<ImportUndoPreview> {
  return invoke<ImportUndoPreview>("preview_import_undo", { id });
}

/** Remove everything one import brought in: the tracks, their files, the
 * albums that empty, their covers, the playlist entries, and beets' memory of
 * the folder — so the same folder can be imported again. */
export function undoImport(id: string): Promise<ImportUndoOutcome> {
  return invoke<ImportUndoOutcome>("undo_import", { id });
}

/** How the import decides what an album is.
 *
 * beets makes one album per *directory*, always. `folder` keeps that, which is
 * right for a ripped or bought library. `tags` re-groups each directory by the
 * album tag its files carry, for a folder holding several records at once.
 * `tracks` says there are no albums here — every file lands on its own, which
 * is what a folder of one-shot rips really is, and the only mode that does not
 * invent a record named after the folder to file unrelated artists under. */
export type Grouping = "folder" | "tags" | "tracks";

/** Copy a folder's music into the library. Resolves when beets is done, which
 * on a real collection is minutes away. */
export function startLibraryImport(
  folder: string,
  grouping: Grouping,
  category: string | null,
): Promise<ImportOutcome> {
  return invoke<ImportOutcome>("start_library_import", { folder, grouping, category });
}

/** Stop the import in flight. Fire-and-forget: the import's own call is what
 * resolves — as cancelled — once beets has actually stopped. */
export function cancelLibraryImport(): Promise<void> {
  return invoke<void>("cancel_library_import");
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
