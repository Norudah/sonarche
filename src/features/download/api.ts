import { invoke } from "@tauri-apps/api/core";

export type JobKind = "single" | "album";
export type JobStatus =
  | "queued"
  | "downloading"
  | "importing"
  | "enriching"
  | "done"
  | "failed"
  /** Terminal, but resumable on retry. */
  | "cancelled";
export type JobStep = "download" | "import" | "enrich";
export type TrackStatus =
  | "pending"
  | "downloading"
  | "downloaded"
  | "imported"
  | "done"
  | "failed"
  /** Removed, private or blocked at the source: not retryable. */
  | "unavailable";

export interface MetadataReportFields {
  title: boolean;
  artist: boolean;
  album: boolean;
  year: boolean;
  track: boolean;
  genre: boolean;
}

export interface MetadataReport {
  /** beets item id, or null if unknown. */
  itemId: number | null;
  /** Tags as filed, so a history row can recognise its item (beets recycles
   * rowids). Null on older reports. */
  title: string | null;
  artist: string | null;
  album: string | null;
  mbMatched: boolean;
  /** Tags guessed from the video, not matched. */
  provisional: boolean;
  source: string | null;
  fields: MetadataReportFields;
  cover: boolean;
  coverSource: string | null;
}

export interface AlbumTrackJob {
  /** 1-based. */
  index: number;
  videoId: string;
  url: string;
  title: string | null;
  duration: number | null;
  status: TrackStatus;
  error: string | null;
  itemId: number | null;
  report: MetadataReport | null;
  /** Kept item id when enrich dropped this track as a duplicate recording. */
  duplicateOf: number | null;
  /** Attempts started; see DOWNLOAD_ATTEMPTS. */
  downloadAttempts: number;
}

export interface DownloadJob {
  id: string;
  url: string;
  kind: JobKind;
  status: JobStatus;
  failedStep: JobStep | null;
  error: string | null;
  title: string | null;
  artist: string | null;
  thumbnail: string | null;
  duration: number | null;
  report: MetadataReport | null;
  /** Empty for singles. */
  tracks: AlbumTrackJob[];
  /** Singles only; album jobs count per track. */
  downloadAttempts: number;
  /** beets `grouping` applied to every item; null leaves it untouched. */
  category: string | null;
  /** User-assigned album overriding the matched releases; usually null. */
  forcedAlbum: ForcedAlbum | null;
  /** One record per playlist (auto mode); reused on re-download. */
  singleAlbum: boolean;
  /** Unavailable playlist slots, skipped but counted. */
  unavailable: number;
  /** When the job's output was undone; the row stays in history. */
  undoneAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/** A forced filing target; per-track artists are kept. */
export interface ForcedAlbum {
  title: string;
  /** Empty falls back to the sidecar's "Various Artists". */
  artist: string | null;
  /** An existing album row; title/artist then only describe it. */
  albumId?: number | null;
}

interface WireReport {
  item_id: number | null;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  mb_matched: boolean;
  provisional?: boolean;
  source: string | null;
  fields: MetadataReportFields;
  cover: boolean;
  cover_source: string | null;
}

interface WireTrack {
  index: number;
  videoId: string;
  url: string;
  title: string | null;
  duration: number | null;
  status: TrackStatus;
  error: string | null;
  stagedPath: string | null;
  itemId: number | null;
  report: WireReport | null;
  duplicateOf?: number | null;
  downloadAttempts?: number;
}

export interface WireJob {
  id: string;
  url: string;
  kind: JobKind;
  status: JobStatus;
  failedStep: JobStep | null;
  error: string | null;
  title: string | null;
  artist: string | null;
  thumbnail: string | null;
  duration: number | null;
  report: WireReport | null;
  tracks?: WireTrack[];
  downloadAttempts?: number;
  category?: string | null;
  forcedAlbum?: ForcedAlbum | null;
  singleAlbum?: boolean;
  unavailable?: number;
  undoneAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

function mapReport(raw: WireReport | null): MetadataReport | null {
  if (!raw) return null;
  return {
    itemId: raw.item_id ?? null,
    title: raw.title ?? null,
    artist: raw.artist ?? null,
    album: raw.album ?? null,
    mbMatched: raw.mb_matched,
    // Absent on reports stored before the flag existed.
    provisional: raw.provisional ?? false,
    source: raw.source,
    fields: raw.fields,
    cover: raw.cover,
    coverSource: raw.cover_source,
  };
}

function mapTrack(raw: WireTrack): AlbumTrackJob {
  return {
    index: raw.index,
    videoId: raw.videoId,
    url: raw.url,
    title: raw.title,
    duration: raw.duration,
    status: raw.status,
    error: raw.error,
    itemId: raw.itemId,
    report: mapReport(raw.report),
    duplicateOf: raw.duplicateOf ?? null,
    downloadAttempts: raw.downloadAttempts ?? 0,
  };
}

export function mapJob(raw: WireJob): DownloadJob {
  return {
    ...raw,
    report: mapReport(raw.report),
    tracks: (raw.tracks ?? []).map(mapTrack),
    downloadAttempts: raw.downloadAttempts ?? 0,
    category: raw.category ?? null,
    forcedAlbum: raw.forcedAlbum ?? null,
    singleAlbum: raw.singleAlbum ?? true,
    unavailable: raw.unavailable ?? 0,
    undoneAt: raw.undoneAt ?? null,
  };
}

export interface EnqueueRequest {
  url: string;
  kind: JobKind;
  /** Canonical category, or null to leave it untouched. */
  category: string | null;
  forcedAlbum: ForcedAlbum | null;
  /** Auto mode: one record per playlist. On by default. */
  singleAlbum: boolean;
}

export async function enqueueDownload({
  url,
  kind,
  category,
  forcedAlbum,
  singleAlbum,
}: EnqueueRequest): Promise<DownloadJob> {
  return mapJob(await invoke<WireJob>("enqueue_download", { url, kind, category, forcedAlbum, singleAlbum }));
}

export async function listJobs(): Promise<DownloadJob[]> {
  const raw = await invoke<WireJob[]>("list_jobs");
  return raw.map(mapJob);
}

/** One archive page and its totals; `list_jobs` only covers the live window. */
export interface JobsPage {
  jobs: DownloadJob[];
  /** All jobs, live included. */
  total: number;
  /** Finished jobs: what "clear history" removes. */
  terminalTotal: number;
}

export async function listJobsPage(offset: number, limit: number): Promise<JobsPage> {
  const raw = await invoke<{ jobs: WireJob[]; total: number; terminalTotal: number }>("list_jobs_page", {
    offset,
    limit,
  });
  return { jobs: raw.jobs.map(mapJob), total: raw.total, terminalTotal: raw.terminalTotal };
}

export async function retryJob(id: string): Promise<DownloadJob> {
  return mapJob(await invoke<WireJob>("retry_job", { id }));
}

export async function cancelJob(id: string): Promise<DownloadJob> {
  return mapJob(await invoke<WireJob>("cancel_job", { id }));
}

export async function clearJobHistory(): Promise<DownloadJob[]> {
  const raw = await invoke<WireJob[]>("clear_job_history");
  return raw.map(mapJob);
}

/** Counted from the current library; same shape as the import undo preview. */
export interface DownloadUndoPreview {
  tracks: number;
  albumsRemoved: number;
  albumsKept: number;
  playlistEntries: number;
}

export interface DownloadUndoOutcome {
  removed: number;
  foreign: number;
  playlistEntries: number;
}

export async function previewDownloadUndo(id: string): Promise<DownloadUndoPreview> {
  return invoke<DownloadUndoPreview>("preview_download_undo", { id });
}

export async function undoDownload(id: string): Promise<DownloadUndoOutcome> {
  return invoke<DownloadUndoOutcome>("undo_download", { id });
}

/** Re-files a finished download onto another album. */
export async function changeJobDestination(id: string, forcedAlbum: ForcedAlbum): Promise<DownloadJob> {
  return mapJob(await invoke<WireJob>("change_job_destination", { id, forcedAlbum }));
}
