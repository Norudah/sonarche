import { useTranslation } from "react-i18next";

import type { AlbumTrackJob, DownloadJob } from "@/features/download/api";
import {
  formatTags,
  jobTags,
  type TagSummary,
  tagTone,
  trackTags,
} from "@/features/download/queue/tags";

const DOT_TONE = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

function TagBadge({ summary, label }: { summary: TagSummary; label: string }) {
  const text = formatTags(summary);
  return (
    <span className="flex items-center gap-2 whitespace-nowrap" aria-label={`${label}: ${text}`}>
      <span className={`size-2 shrink-0 rounded-full ${DOT_TONE[tagTone(summary)]}`} />
      <span className="text-sm tabular-nums">{text}</span>
    </span>
  );
}

function Dash() {
  return <span className="text-sm text-muted">—</span>;
}

export function JobTagsCell({ job }: { job: DownloadJob }) {
  const { t } = useTranslation("download");
  if (job.status !== "done") return <Dash />;
  const summary = jobTags(job);
  if (!summary) return <span className="text-sm text-muted">{t("queue.noReport")}</span>;
  return <TagBadge summary={summary} label={t("queue.colTags")} />;
}

export function TrackTagsCell({ track }: { track: AlbumTrackJob }) {
  const { t } = useTranslation("download");
  // Dropped as a content duplicate: there is no item left to report on.
  if (track.duplicateOf != null || track.status !== "done") return <Dash />;
  const summary = trackTags("album", track.report);
  if (!summary) return <span className="text-sm text-muted">{t("queue.noReport")}</span>;
  return <TagBadge summary={summary} label={t("queue.colTags")} />;
}
