import type { DownloadJob, JobKind, MetadataReport } from "@/features/download/api";

/** Tracks report their fields; albums the mean completion. */
export type TagSummary = { provisional: boolean } & (
  { kind: "ratio"; filled: number; total: number } | { kind: "percent"; value: number }
);

/** Managed fields, as in the inspector; album tracks add their position. */
function wantedFields(kind: JobKind, report: MetadataReport): boolean[] {
  const common = [report.fields.title, report.fields.artist, report.fields.year, report.fields.genre, report.cover];
  return kind === "album" ? [...common, report.fields.album, report.fields.track] : common;
}

/** Managed tags present on the file; guessed tags count, flagged `provisional`. */
export function trackTags(kind: JobKind, report: MetadataReport | null): TagSummary | null {
  if (!report) return null;
  const wanted = wantedFields(kind, report);
  return {
    kind: "ratio",
    filled: report.mbMatched || report.provisional ? wanted.filter(Boolean).length : 0,
    total: wanted.length,
    provisional: report.provisional,
  };
}

/** Mean over tracks; dropped duplicates are excluded. */
function albumTags(job: DownloadJob): TagSummary | null {
  const summaries = job.tracks
    .filter((track) => track.duplicateOf == null)
    .map((track) => trackTags("album", track.report))
    .filter((summary) => summary != null);
  if (summaries.length === 0) return null;
  const ratios = summaries.map((s) => (s.kind === "ratio" ? s.filled / s.total : 0));
  const mean = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  // One guessed track makes the album figure unreliable.
  return {
    kind: "percent",
    value: Math.round(mean * 100),
    provisional: summaries.some((s) => s.provisional),
  };
}

export function jobTags(job: DownloadJob): TagSummary | null {
  return job.kind === "album" && job.tracks.length > 0 ? albumTags(job) : trackTags(job.kind, job.report);
}

export function tagTone(summary: TagSummary): "success" | "warning" | "danger" {
  // Complete but unverified.
  if (summary.provisional) return "warning";
  const ratio = summary.kind === "percent" ? summary.value / 100 : summary.filled / summary.total;
  if (ratio === 1) return "success";
  return ratio === 0 ? "danger" : "warning";
}

export function formatTags(summary: TagSummary): string {
  return summary.kind === "percent" ? `${summary.value} %` : `${summary.filled}/${summary.total}`;
}
