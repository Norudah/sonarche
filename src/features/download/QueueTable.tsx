import { Button, Chip, ProgressCircle, Spinner, Table } from "@heroui/react";
import { CircleAlert, CircleCheck, Clock, FileText, Music, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { DownloadJob } from "@/features/download/api";
import { useRetryJob } from "@/features/download/hooks";
import type { LibraryTrack } from "@/features/library/api";
import { DeleteTrackDialog } from "@/features/library/DeleteTrackDialog";
import { useLibrary } from "@/features/library/hooks";
import { MetadataDrawer } from "@/features/library/MetadataDrawer";
import { formatDuration } from "@/shared/lib/format";

/** Share of expected metadata fields actually filled, per job kind. A single
 * only needs track-level info; an album track also needs its place in the set.
 * Without a trusted match nothing counts: unmatched files keep YouTube-free,
 * empty tags by design, so their completion is 0. */
function metadataCompletion(job: DownloadJob): number | null {
  const report = job.report;
  if (!report) return null;
  if (!report.mbMatched) return 0;
  const wanted =
    job.kind === "album"
      ? [
          report.fields.title,
          report.fields.artist,
          report.fields.album,
          report.fields.year,
          report.fields.track,
          report.fields.genre,
          report.cover,
        ]
      : [
          report.fields.title,
          report.fields.artist,
          report.fields.year,
          report.fields.genre,
          report.cover,
        ];
  return Math.round((wanted.filter(Boolean).length / wanted.length) * 100);
}

function StateCircle({
  value,
  isIndeterminate,
  color,
  label,
}: {
  value?: number;
  isIndeterminate?: boolean;
  color: "accent" | "success" | "warning" | "danger";
  label: string;
}) {
  return (
    <ProgressCircle
      value={value}
      isIndeterminate={isIndeterminate}
      size="sm"
      color={color}
      aria-label={label}
    >
      <ProgressCircle.Track>
        <ProgressCircle.TrackCircle />
        <ProgressCircle.FillCircle />
      </ProgressCircle.Track>
    </ProgressCircle>
  );
}

function DownloadStateCell({ job, percent }: { job: DownloadJob; percent: number | null }) {
  const { t } = useTranslation("download");
  switch (job.status) {
    case "queued":
      return <Clock aria-label={t("queue.statusQueued")} className="size-5 text-muted" />;
    case "downloading":
      return (
        <div className="flex items-center gap-2">
          <StateCircle
            value={percent ?? undefined}
            isIndeterminate={percent == null}
            color="accent"
            label={t("queue.statusDownloading")}
          />
          {percent != null && (
            <span className="text-sm tabular-nums text-muted">{Math.round(percent)}%</span>
          )}
        </div>
      );
    case "failed":
      if (job.failedStep === "download") {
        return <CircleAlert aria-label={t("queue.statusFailed")} className="size-5 text-danger" />;
      }
      break;
  }
  // Importing, done, or failed later in the pipeline: the download itself succeeded.
  return <CircleCheck aria-label={t("queue.statusDone")} className="size-5 text-success" />;
}

function MatchCell({ job }: { job: DownloadJob }) {
  const { t } = useTranslation("download");
  if (job.status !== "done") {
    return <span className="text-sm text-muted">—</span>;
  }
  if (job.report?.mbMatched) {
    return (
      <Chip variant="soft" size="sm" color="success">
        {job.report.source ?? t("queue.matched")}
      </Chip>
    );
  }
  return (
    <Chip variant="soft" size="sm" color="danger">
      {t("queue.matchNone")}
    </Chip>
  );
}

function MetadataStateCell({ job }: { job: DownloadJob }) {
  const { t } = useTranslation("download");
  if (job.status === "importing") {
    return <Spinner size="sm" aria-label={t("queue.statusImporting")} />;
  }
  if (job.status === "failed" && job.failedStep === "import") {
    return <CircleAlert aria-label={t("queue.statusFailed")} className="size-5 text-danger" />;
  }
  if (job.status !== "done") {
    return <span className="text-sm text-muted">—</span>;
  }
  const completion = metadataCompletion(job);
  if (completion == null) {
    return <span className="text-sm text-muted">{t("queue.noReport")}</span>;
  }
  const color = completion === 100 ? "success" : completion >= 50 ? "warning" : "danger";
  return (
    <div className="flex items-center gap-2">
      <StateCircle value={completion} color={color} label={t("queue.colMetadata")} />
      <span className="text-sm tabular-nums text-muted">{completion}%</span>
    </div>
  );
}

function LibraryCell({
  job,
  track,
  libraryLoaded,
}: {
  job: DownloadJob;
  track: LibraryTrack | undefined;
  libraryLoaded: boolean;
}) {
  const { t } = useTranslation("download");
  // Only a completed import with a known item id can be linked to the library.
  if (job.status !== "done" || job.report?.itemId == null || !libraryLoaded) {
    return <span className="text-sm text-muted">—</span>;
  }
  if (track) {
    return (
      <Chip variant="soft" size="sm" color="success">
        {t("queue.inLibrary")}
      </Chip>
    );
  }
  return (
    <Chip variant="soft" size="sm" color="default">
      {t("queue.removedFromLibrary")}
    </Chip>
  );
}

function TrackCell({ job }: { job: DownloadJob }) {
  const { t } = useTranslation("download");
  return (
    <div className="flex items-center gap-3">
      {job.thumbnail ? (
        <img src={job.thumbnail} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
          <Music className="size-4 text-muted" />
        </div>
      )}
      <div className="min-w-0">
        <p className="max-w-md truncate text-sm font-medium">{job.title ?? job.url}</p>
        <p className="truncate text-xs text-muted">
          {job.artist ?? t("unknownArtist")}
          {job.duration != null && ` · ${formatDuration(job.duration)}`}
        </p>
        {job.status === "failed" && job.error && (
          <p className="max-w-md truncate text-xs text-danger" title={job.error}>
            {job.error}
          </p>
        )}
      </div>
    </div>
  );
}

interface QueueTableProps {
  jobs: DownloadJob[];
  /** Percent of the one currently downloading job (the queue is sequential). */
  downloadPercent: number | null;
}

export function QueueTable({ jobs, downloadPercent }: QueueTableProps) {
  const { t } = useTranslation("download");
  const retry = useRetryJob();
  const library = useLibrary();
  const [inspected, setInspected] = useState<LibraryTrack | null>(null);
  const [deleting, setDeleting] = useState<LibraryTrack | null>(null);

  if (jobs.length === 0) {
    return <p className="text-sm text-muted">{t("queue.empty")}</p>;
  }

  const trackById = new Map((library.data ?? []).map((track) => [track.id, track]));
  const trackFor = (job: DownloadJob) =>
    job.report?.itemId != null ? trackById.get(job.report.itemId) : undefined;

  return (
    <>
      <Table aria-label={t("queue.heading")}>
        <Table.Content aria-label={t("queue.heading")}>
          <Table.Header>
            <Table.Column isRowHeader className="w-full">
              {t("queue.colTrack")}
            </Table.Column>
            <Table.Column>{t("queue.colDownload")}</Table.Column>
            <Table.Column>{t("queue.colKind")}</Table.Column>
            <Table.Column>{t("queue.colMatch")}</Table.Column>
            <Table.Column>{t("queue.colMetadata")}</Table.Column>
            <Table.Column>{t("queue.colLibrary")}</Table.Column>
            <Table.Column>
              <span className="sr-only">{t("queue.colActions")}</span>
            </Table.Column>
          </Table.Header>
          <Table.Body items={jobs}>
            {(job) => {
              const track = trackFor(job);
              return (
                <Table.Row id={job.id}>
                  <Table.Cell>
                    <TrackCell job={job} />
                  </Table.Cell>
                  <Table.Cell>
                    <DownloadStateCell
                      job={job}
                      percent={job.status === "downloading" ? downloadPercent : null}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Chip variant="soft" size="sm">
                      {job.kind === "album" ? t("queue.kindAlbum") : t("queue.kindSingle")}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>
                    <MatchCell job={job} />
                  </Table.Cell>
                  <Table.Cell>
                    <MetadataStateCell job={job} />
                  </Table.Cell>
                  <Table.Cell>
                    <LibraryCell job={job} track={track} libraryLoaded={library.data != null} />
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center justify-end gap-1">
                      {job.status === "failed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          isDisabled={retry.isPending}
                          onPress={() => retry.mutate(job.id)}
                        >
                          <RotateCcw className="size-4" />
                          {t("queue.retry")}
                        </Button>
                      )}
                      {track && (
                        <>
                          <Button
                            variant="tertiary"
                            size="sm"
                            isIconOnly
                            onPress={() => setInspected(track)}
                            aria-label={t("queue.inspect")}
                          >
                            <FileText className="size-4" />
                          </Button>
                          <Button
                            variant="tertiary"
                            size="sm"
                            isIconOnly
                            onPress={() => setDeleting(track)}
                            aria-label={t("queue.delete")}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              );
            }}
          </Table.Body>
        </Table.Content>
      </Table>

      <MetadataDrawer track={inspected} onClose={() => setInspected(null)} />
      <DeleteTrackDialog track={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
