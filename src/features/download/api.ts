import { invoke } from "@tauri-apps/api/core";

export type JobKind = "single" | "album";
export type JobStatus = "queued" | "downloading" | "importing" | "enriching" | "done" | "failed";
export type JobStep = "download" | "import" | "enrich";
export type TrackStatus = "pending" | "downloading" | "downloaded" | "imported" | "done" | "failed";

export interface MetadataReportFields {
  title: boolean;
  artist: boolean;
  album: boolean;
  year: boolean;
  track: boolean;
  genre: boolean;
}

export interface MetadataReport {
  /** beets item id — links the job to its library track (null if unknown). */
  itemId: number | null;
  mbMatched: boolean;
  /** Tags were written but guessed from the video, not matched — never trust
   * them without a second pass. See the sidecar's `provisional` module. */
  provisional: boolean;
  source: string | null;
  fields: MetadataReportFields;
  cover: boolean;
  coverSource: string | null;
}

/** One playlist entry of an album job. */
export interface AlbumTrackJob {
  /** 1-based playlist position. */
  index: number;
  videoId: string;
  url: string;
  title: string | null;
  duration: number | null;
  status: TrackStatus;
  error: string | null;
  itemId: number | null;
  report: MetadataReport | null;
  /** Kept item id when the enrich step dropped this track as a content
   * duplicate (same AcoustID recording under another video title). */
  duplicateOf: number | null;
  /** Download attempts started, 0 before the first. See DOWNLOAD_ATTEMPTS. */
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
  /** Album jobs only; empty for singles. */
  tracks: AlbumTrackJob[];
  /** Download attempts started for a single; album jobs count per track. */
  downloadAttempts: number;
  createdAt: number;
  updatedAt: number;
}

interface WireReport {
  item_id: number | null;
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
  createdAt: number;
  updatedAt: number;
}

function mapReport(raw: WireReport | null): MetadataReport | null {
  if (!raw) return null;
  return {
    itemId: raw.item_id ?? null,
    mbMatched: raw.mb_matched,
    // Absent from reports stored before the flag existed: those jobs predate
    // provisional tagging, so they never guessed anything.
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
  };
}

export async function enqueueDownload(url: string, kind: JobKind): Promise<DownloadJob> {
  return mapJob(await invoke<WireJob>("enqueue_download", { url, kind }));
}

export async function listJobs(): Promise<DownloadJob[]> {
  const raw = await invoke<WireJob[]>("list_jobs");
  return raw.map(mapJob);
}

export async function retryJob(id: string): Promise<DownloadJob> {
  return mapJob(await invoke<WireJob>("retry_job", { id }));
}

export async function clearJobHistory(): Promise<DownloadJob[]> {
  const raw = await invoke<WireJob[]>("clear_job_history");
  return raw.map(mapJob);
}
