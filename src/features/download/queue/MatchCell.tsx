import { Chip } from "@heroui/react";
import { useTranslation } from "react-i18next";

import type { AlbumTrackJob, DownloadJob, MetadataReport } from "@/features/download/api";
import { EmptyCell } from "@/features/download/queue/EmptyCell";

function SourceChip({ report }: { report: MetadataReport | null }) {
  const { t } = useTranslation("download");
  if (report?.mbMatched) {
    return (
      <Chip variant="soft" size="sm" color="success">
        {report.source ?? t("queue.matched")}
      </Chip>
    );
  }
  return (
    <Chip variant="soft" size="sm" color="danger">
      {t("queue.matchNone")}
    </Chip>
  );
}

export function JobMatchCell({ job }: { job: DownloadJob }) {
  const { t } = useTranslation("download");
  if (job.status !== "done") return <EmptyCell />;
  if (job.kind !== "album" || job.tracks.length === 0) {
    return <SourceChip report={job.report} />;
  }
  // Dropped duplicates have no report by design; they must not drag the album
  // aggregate down to a warning state.
  const real = job.tracks.filter((track) => track.duplicateOf == null);
  const matched = real.filter((track) => track.report?.mbMatched);
  if (real.length > 0 && matched.length === real.length) {
    const source = matched.find((track) => track.report?.source)?.report?.source;
    return (
      <Chip variant="soft" size="sm" color="success">
        {source ?? t("queue.matched")}
      </Chip>
    );
  }
  if (matched.length > 0) {
    return (
      <Chip variant="soft" size="sm" color="warning">
        {matched.length}/{real.length}
      </Chip>
    );
  }
  return (
    <Chip variant="soft" size="sm" color="danger">
      {t("queue.matchNone")}
    </Chip>
  );
}

export function TrackMatchCell({ track }: { track: AlbumTrackJob }) {
  const { t } = useTranslation("download");
  if (track.duplicateOf != null) {
    return (
      <Chip variant="soft" size="sm" color="default">
        {t("queue.duplicate")}
      </Chip>
    );
  }
  if (track.status !== "done") return <EmptyCell />;
  return <SourceChip report={track.report} />;
}
