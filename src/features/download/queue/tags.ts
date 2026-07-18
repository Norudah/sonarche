import type { DownloadJob, JobKind, MetadataReport } from "@/features/download/api";

/** A track reports the exact fields it carries; an album is too many numbers to
 * read at a glance, so it reports the mean completion instead. */
export type TagSummary =
  | { kind: "ratio"; filled: number; total: number }
  | { kind: "percent"; value: number };

/** Metadata fields we manage per track — the same ones the inspector shows. An
 * album track also carries its place in the set; a single does not. */
function wantedFields(kind: JobKind, report: MetadataReport): boolean[] {
  const common = [
    report.fields.title,
    report.fields.artist,
    report.fields.year,
    report.fields.genre,
    report.cover,
  ];
  return kind === "album" ? [...common, report.fields.album, report.fields.track] : common;
}

/** How many managed tags a track actually carries. Without a trusted match
 * nothing counts: unmatched files keep YouTube-free, empty tags by design. */
export function trackTags(kind: JobKind, report: MetadataReport | null): TagSummary | null {
  if (!report) return null;
  const wanted = wantedFields(kind, report);
  return {
    kind: "ratio",
    filled: report.mbMatched ? wanted.filter(Boolean).length : 0,
    total: wanted.length,
  };
}

/** Mean completion over the album's tracks. Dropped duplicates have no report
 * by design and must not drag the average down. */
function albumTags(job: DownloadJob): TagSummary | null {
  const ratios = job.tracks
    .filter((track) => track.duplicateOf == null)
    .map((track) => trackTags("album", track.report))
    .filter((summary) => summary != null)
    .map((summary) => (summary.kind === "ratio" ? summary.filled / summary.total : 0));
  if (ratios.length === 0) return null;
  const mean = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  return { kind: "percent", value: Math.round(mean * 100) };
}

export function jobTags(job: DownloadJob): TagSummary | null {
  return job.kind === "album" && job.tracks.length > 0
    ? albumTags(job)
    : trackTags(job.kind, job.report);
}

export function tagTone(summary: TagSummary): "success" | "warning" | "danger" {
  const ratio = summary.kind === "percent" ? summary.value / 100 : summary.filled / summary.total;
  if (ratio === 1) return "success";
  return ratio === 0 ? "danger" : "warning";
}

export function formatTags(summary: TagSummary): string {
  return summary.kind === "percent" ? `${summary.value} %` : `${summary.filled}/${summary.total}`;
}
