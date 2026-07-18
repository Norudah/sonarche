import type { DownloadJob, JobKind, MetadataReport } from "@/features/download/api";

export interface TagCount {
  filled: number;
  total: number;
}

/** Metadata fields we manage per track — the same ones the inspector shows. An
 * album track also carries its place in the set; a single does not. */
function wantedFields(kind: JobKind, report: MetadataReport): boolean[] {
  const common = [report.fields.title, report.fields.artist, report.fields.year, report.fields.genre, report.cover];
  return kind === "album" ? [...common, report.fields.album, report.fields.track] : common;
}

/** How many managed tags a track actually carries. Without a trusted match
 * nothing counts: unmatched files keep YouTube-free, empty tags by design. */
export function trackTags(kind: JobKind, report: MetadataReport | null): TagCount | null {
  if (!report) return null;
  const wanted = wantedFields(kind, report);
  return { filled: report.mbMatched ? wanted.filter(Boolean).length : 0, total: wanted.length };
}

/** An album counts fully-tagged tracks, not fields: "14/14" reads as a set that
 * came out clean. Dropped duplicates have no report by design and are excluded. */
export function albumTags(job: DownloadJob): TagCount | null {
  const real = job.tracks.filter((track) => track.duplicateOf == null);
  if (real.length === 0) return null;
  const complete = real.filter((track) => {
    const count = trackTags("album", track.report);
    return count != null && count.filled === count.total;
  }).length;
  return { filled: complete, total: real.length };
}

export function jobTags(job: DownloadJob): TagCount | null {
  return job.kind === "album" && job.tracks.length > 0 ? albumTags(job) : trackTags(job.kind, job.report);
}

export function tagTone(count: TagCount): "success" | "warning" | "danger" {
  if (count.filled === count.total) return "success";
  return count.filled === 0 ? "danger" : "warning";
}
