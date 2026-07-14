import { invoke } from "@tauri-apps/api/core";

export type JobKind = "single" | "album";
export type JobStatus = "queued" | "downloading" | "importing" | "done" | "failed";
export type JobStep = "download" | "import";

export interface MetadataReportFields {
  title: boolean;
  artist: boolean;
  album: boolean;
  year: boolean;
  track: boolean;
  genre: boolean;
}

export interface MetadataReport {
  mbMatched: boolean;
  source: string | null;
  fields: MetadataReportFields;
  cover: boolean;
  coverSource: string | null;
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
  createdAt: number;
  updatedAt: number;
}

interface WireReport {
  mb_matched: boolean;
  source: string | null;
  fields: MetadataReportFields;
  cover: boolean;
  cover_source: string | null;
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
  createdAt: number;
  updatedAt: number;
}

export function mapJob(raw: WireJob): DownloadJob {
  return {
    ...raw,
    report: raw.report
      ? {
          mbMatched: raw.report.mb_matched,
          source: raw.report.source,
          fields: raw.report.fields,
          cover: raw.report.cover,
          coverSource: raw.report.cover_source,
        }
      : null,
  };
}

export async function enqueueDownload(url: string): Promise<DownloadJob> {
  return mapJob(await invoke<WireJob>("enqueue_download", { url }));
}

export async function listJobs(): Promise<DownloadJob[]> {
  const raw = await invoke<WireJob[]>("list_jobs");
  return raw.map(mapJob);
}

export async function retryJob(id: string): Promise<DownloadJob> {
  return mapJob(await invoke<WireJob>("retry_job", { id }));
}
