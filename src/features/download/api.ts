import { invoke } from "@tauri-apps/api/core";

export type JobKind = "single" | "album";
export type JobStatus =
  | "queued"
  | "downloading"
  | "importing"
  | "enriching"
  | "done"
  | "failed"
  /** Stopped by the user. Terminal, but nothing went wrong: resume markers
   * survive, so the job can be retried and picks up where it stopped. */
  | "cancelled";
export type JobStep = "download" | "import" | "enrich";
export type TrackStatus =
  | "pending"
  | "downloading"
  | "downloaded"
  | "imported"
  | "done"
  | "failed"
  /** YouTube will never serve this one — deleted, private, blocked or claimed
   * since the playlist was assembled. Not a failure of ours, and not
   * retryable: the playlist lists a video that no longer plays. */
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
  /** beets item id — links the job to its library track (null if unknown). */
  itemId: number | null;
  /** The tags as filed, so a history row can later recognise its item: beets
   * recycles deleted rowids, and an id alone cannot say "this is still the
   * track I filed". Null on reports written before these existed. */
  title: string | null;
  artist: string | null;
  album: string | null;
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
  /** The library category the job was queued with (beets' `grouping`), stamped
   * onto every item it produced. Null on jobs queued before the option existed,
   * and whenever the user chose to leave the axis alone. */
  category: string | null;
  /** The album the user declared this playlist to be, overriding whatever
   * releases its tracks belong to. Null on every ordinary download. */
  forcedAlbum: ForcedAlbum | null;
  /** Playlist slots whose video was deleted, private or claimed — skipped
   * before download (they could only fail), but the set has holes YouTube
   * cannot even name, and the user deserves to know. */
  unavailable: number;
  /** When the job's library output was taken back out (undo), or null. The
   * row stays in the history; this is what its labels read instead of asking
   * the library whether the tracks survive. */
  undoneAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/** The album the download must land on — a record assembled by hand (a film, a
 * series, a game), or one already on the shelf. The per-track artist survives
 * it: only the filing is forced. */
export interface ForcedAlbum {
  title: string;
  /** Left to the sidecar's compilation default ("Various Artists") when empty. */
  artist: string | null;
  /** An existing beets album row to land on. With an id, title/artist above
   * only describe the target; the backend moves the items onto it post-enrich. */
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
    category: raw.category ?? null,
    forcedAlbum: raw.forcedAlbum ?? null,
    unavailable: raw.unavailable ?? 0,
    undoneAt: raw.undoneAt ?? null,
  };
}

/** What the composer sends: the link, what to make of it, and the options the
 * advanced panel collected. Grouped rather than passed as loose positionals
 * because the panel is where the next option will land too. */
export interface EnqueueRequest {
  url: string;
  kind: JobKind;
  /** Canonical category value, or null to leave the axis untouched. */
  category: string | null;
  /** One album for the whole playlist, or null to let the pipeline decide. */
  forcedAlbum: ForcedAlbum | null;
}

export async function enqueueDownload({ url, kind, category, forcedAlbum }: EnqueueRequest): Promise<DownloadJob> {
  return mapJob(await invoke<WireJob>("enqueue_download", { url, kind, category, forcedAlbum }));
}

export async function listJobs(): Promise<DownloadJob[]> {
  const raw = await invoke<WireJob[]>("list_jobs");
  return raw.map(mapJob);
}

/** One page of the whole archive, plus the totals the history page counts on.
 * `list_jobs` only carries the live window; this is the way to the rest. */
export interface JobsPage {
  jobs: DownloadJob[];
  /** Every job in the store, live included — what the page count divides. */
  total: number;
  /** Terminal jobs only — what "clear history" would sweep. */
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

/** What undoing a download would take away, counted from the library as it is
 * now. The same sentence shapes as the import undo's preview, on purpose. */
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

/** Re-file what a finished download put in the library onto another record —
 * the composer's destination option, after the fact. */
export async function changeJobDestination(id: string, forcedAlbum: ForcedAlbum): Promise<DownloadJob> {
  return mapJob(await invoke<WireJob>("change_job_destination", { id, forcedAlbum }));
}
