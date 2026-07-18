import { useTranslation } from "react-i18next";

import type { AlbumTrackJob, DownloadJob } from "@/features/download/api";
import { jobTags, type TagCount, tagTone, trackTags } from "@/features/download/queue/tags";

const DOT_TONE = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

function TagBadge({ count, label }: { count: TagCount; label: string }) {
  return (
    <span className="flex items-center gap-2" aria-label={`${label}: ${count.filled}/${count.total}`}>
      <span className={`size-2 shrink-0 rounded-full ${DOT_TONE[tagTone(count)]}`} />
      <span className="text-sm tabular-nums">
        {count.filled}/{count.total}
      </span>
    </span>
  );
}

function Dash() {
  return <span className="text-sm text-muted">—</span>;
}

export function JobTagsCell({ job }: { job: DownloadJob }) {
  const { t } = useTranslation("download");
  if (job.status !== "done") return <Dash />;
  const count = jobTags(job);
  if (!count) return <span className="text-sm text-muted">{t("queue.noReport")}</span>;
  return <TagBadge count={count} label={t("queue.colTags")} />;
}

export function TrackTagsCell({ track }: { track: AlbumTrackJob }) {
  const { t } = useTranslation("download");
  // Dropped as a content duplicate: there is no item left to report on.
  if (track.duplicateOf != null || track.status !== "done") return <Dash />;
  const count = trackTags("album", track.report);
  if (!count) return <span className="text-sm text-muted">{t("queue.noReport")}</span>;
  return <TagBadge count={count} label={t("queue.colTags")} />;
}
