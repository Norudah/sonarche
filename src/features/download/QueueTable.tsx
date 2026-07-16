import { Button, Chip, ProgressCircle, Spinner, Table } from "@heroui/react";
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Disc3,
  FileText,
  Music,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  AlbumTrackJob,
  DownloadJob,
  JobKind,
  MetadataReport,
} from "@/features/download/api";
import { type EnrichStage, useRetryJob } from "@/features/download/hooks";
import type { LibraryTrack } from "@/features/library/api";
import { DeleteTrackDialog } from "@/features/library/DeleteTrackDialog";
import { useLibrary } from "@/features/library/hooks";
import { MetadataDrawer } from "@/features/library/MetadataDrawer";
import { formatDuration } from "@/shared/lib/format";

/** Share of expected metadata fields actually filled, per job kind. A single
 * only needs track-level info; an album track also needs its place in the set.
 * Without a trusted match nothing counts: unmatched files keep YouTube-free,
 * empty tags by design, so their completion is 0. */
function metadataCompletion(kind: JobKind, report: MetadataReport | null): number | null {
  if (!report) return null;
  if (!report.mbMatched) return 0;
  const wanted =
    kind === "album"
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

/** Mean completion over the album's tracks that produced a report. */
function albumCompletion(job: DownloadJob): number | null {
  const values = job.tracks
    .map((track) => metadataCompletion("album", track.report))
    .filter((value): value is number => value != null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** A track no longer waiting on the network: its file is on disk (or failed). */
function isFetched(track: AlbumTrackJob): boolean {
  return track.status === "downloaded" || track.status === "imported" || track.status === "done";
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

function CompletionCircle({ completion, label }: { completion: number; label: string }) {
  const color = completion === 100 ? "success" : completion >= 50 ? "warning" : "danger";
  return (
    <div className="flex items-center gap-2">
      <StateCircle value={completion} color={color} label={label} />
      <span className="text-sm tabular-nums text-muted">{completion}%</span>
    </div>
  );
}

function DownloadStateCell({ job, percent }: { job: DownloadJob; percent: number | null }) {
  const { t } = useTranslation("download");
  switch (job.status) {
    case "queued":
      return <Clock aria-label={t("queue.statusQueued")} className="size-5 text-muted" />;
    case "downloading":
      if (job.kind === "album" && job.tracks.length > 0) {
        // The album batch: how many tracks are on disk, not byte progress —
        // the per-track percent lives on the expanded child row.
        const fetched = job.tracks.filter(isFetched).length;
        return (
          <div className="flex items-center gap-2">
            <StateCircle
              value={(fetched / job.tracks.length) * 100}
              color="accent"
              label={t("queue.statusDownloading")}
            />
            <span className="text-sm tabular-nums text-muted">
              {fetched}/{job.tracks.length}
            </span>
          </div>
        );
      }
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

function TrackDownloadStateCell({
  track,
  percent,
}: {
  track: AlbumTrackJob;
  percent: number | null;
}) {
  const { t } = useTranslation("download");
  switch (track.status) {
    case "pending":
      return <Clock aria-label={t("queue.statusPending")} className="size-5 text-muted" />;
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
      return <CircleAlert aria-label={t("queue.statusFailed")} className="size-5 text-danger" />;
    default:
      return (
        <CircleCheck aria-label={t("queue.statusTrackDownloaded")} className="size-5 text-success" />
      );
  }
}

function MatchChip({ report }: { report: MetadataReport | null }) {
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

function MatchCell({ job }: { job: DownloadJob }) {
  const { t } = useTranslation("download");
  if (job.status !== "done") {
    return <span className="text-sm text-muted">—</span>;
  }
  if (job.kind === "album" && job.tracks.length > 0) {
    // Dropped duplicates have no report by design; they must not drag the
    // album aggregate down to a warning state.
    const real = job.tracks.filter((track) => track.duplicateOf == null);
    const matched = real.filter((track) => track.report?.mbMatched).length;
    if (real.length > 0 && matched === real.length) {
      const source = real.find((track) => track.report?.source)?.report?.source;
      return (
        <Chip variant="soft" size="sm" color="success">
          {source ?? t("queue.matched")}
        </Chip>
      );
    }
    if (matched > 0) {
      return (
        <Chip variant="soft" size="sm" color="warning">
          {matched}/{real.length}
        </Chip>
      );
    }
    return (
      <Chip variant="soft" size="sm" color="danger">
        {t("queue.matchNone")}
      </Chip>
    );
  }
  return <MatchChip report={job.report} />;
}

function TrackMatchCell({ track }: { track: AlbumTrackJob }) {
  const { t } = useTranslation("download");
  if (track.duplicateOf != null) {
    return (
      <Chip variant="soft" size="sm" color="default">
        {t("queue.duplicate")}
      </Chip>
    );
  }
  if (track.status !== "done") {
    return <span className="text-sm text-muted">—</span>;
  }
  return <MatchChip report={track.report} />;
}

function MetadataStateCell({
  job,
  enrichStages,
}: {
  job: DownloadJob;
  enrichStages: Record<number, EnrichStage>;
}) {
  const { t } = useTranslation("download");
  if (job.status === "importing") {
    return <Spinner size="sm" aria-label={t("queue.statusImporting")} />;
  }
  if (job.status === "enriching") {
    // Album batch: count the per-track completion events as they stream in.
    const enrichable = job.tracks.filter((track) => track.itemId != null);
    const done = enrichable.filter(
      (track) => enrichStages[track.itemId as number] === "track_done",
    ).length;
    return (
      <div className="flex items-center gap-2">
        <Spinner size="sm" aria-label={t("queue.statusEnriching")} />
        <span className="text-xs text-muted">
          {job.kind === "album" && enrichable.length > 0
            ? `${done}/${enrichable.length}`
            : t("queue.statusEnriching")}
        </span>
      </div>
    );
  }
  if (job.status === "failed" && (job.failedStep === "import" || job.failedStep === "enrich")) {
    return <CircleAlert aria-label={t("queue.statusFailed")} className="size-5 text-danger" />;
  }
  if (job.status !== "done") {
    return <span className="text-sm text-muted">—</span>;
  }
  const completion =
    job.kind === "album" ? albumCompletion(job) : metadataCompletion(job.kind, job.report);
  if (completion == null) {
    return <span className="text-sm text-muted">{t("queue.noReport")}</span>;
  }
  return <CompletionCircle completion={completion} label={t("queue.colMetadata")} />;
}

function TrackMetadataCell({ track, stage }: { track: AlbumTrackJob; stage?: EnrichStage }) {
  const { t } = useTranslation("download");
  if (track.duplicateOf != null) {
    // Dropped as a content duplicate: there is no item left to report on.
    return <span className="text-sm text-muted">—</span>;
  }
  if (track.status === "failed") {
    return <CircleAlert aria-label={t("queue.statusFailed")} className="size-5 text-danger" />;
  }
  if (track.status !== "done") {
    // Live view while the album-wide enrich request runs: this track's own
    // events light the row up before the final per-track reports land.
    if (stage === "track_done") {
      return (
        <CircleCheck aria-label={t("queue.statusEnriched")} className="size-5 text-success" />
      );
    }
    if (stage != null) {
      return <Spinner size="sm" aria-label={t("queue.statusEnriching")} />;
    }
    return <span className="text-sm text-muted">—</span>;
  }
  const completion = metadataCompletion("album", track.report);
  if (completion == null) {
    return <span className="text-sm text-muted">{t("queue.noReport")}</span>;
  }
  return <CompletionCircle completion={completion} label={t("queue.colMetadata")} />;
}

function LibraryChip({ track }: { track: LibraryTrack | undefined }) {
  const { t } = useTranslation("download");
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

function TrackCell({
  job,
  isExpanded,
  onToggle,
}: {
  job: DownloadJob;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation("download");
  const isAlbum = job.kind === "album";
  const doneTracks = job.tracks.filter((track) => track.status === "done").length;
  return (
    <div className="flex items-center gap-3">
      {isAlbum && (
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          aria-expanded={isExpanded}
          aria-label={isExpanded ? t("queue.collapse") : t("queue.expand")}
          onPress={onToggle}
          isDisabled={job.tracks.length === 0}
        >
          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </Button>
      )}
      {job.thumbnail ? (
        <img src={job.thumbnail} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
          {isAlbum ? <Disc3 className="size-4 text-muted" /> : <Music className="size-4 text-muted" />}
        </div>
      )}
      <div className="min-w-0">
        <p className="max-w-52 truncate text-sm font-medium">{job.title ?? job.url}</p>
        <p className="truncate text-xs text-muted">
          {job.artist ?? t("unknownArtist")}
          {isAlbum && job.tracks.length > 0
            ? ` · ${t("queue.tracks", { done: doneTracks, total: job.tracks.length })}`
            : job.duration != null && ` · ${formatDuration(job.duration)}`}
        </p>
        {job.status === "failed" && job.error && (
          <p className="max-w-52 truncate text-xs text-danger" title={job.error}>
            {job.error}
          </p>
        )}
      </div>
    </div>
  );
}

function AlbumTrackCell({ track }: { track: AlbumTrackJob }) {
  return (
    <div className="min-w-0 pl-12">
      <p className="max-w-52 truncate text-sm">
        <span className="mr-2 tabular-nums text-muted">#{track.index}</span>
        {track.title ?? track.url}
      </p>
      {track.duration != null && (
        <p className="truncate text-xs text-muted">{formatDuration(track.duration)}</p>
      )}
      {track.status === "failed" && track.error && (
        <p className="max-w-52 truncate text-xs text-danger" title={track.error}>
          {track.error}
        </p>
      )}
    </div>
  );
}

interface QueueTableProps {
  jobs: DownloadJob[];
  /** Percent of the one currently downloading job (the queue is sequential). */
  downloadPercent: number | null;
  /** Live enrich stage per beets item id, for the one currently enriching job. */
  enrichStages: Record<number, EnrichStage>;
}

export function QueueTable({ jobs, downloadPercent, enrichStages }: QueueTableProps) {
  const { t } = useTranslation("download");
  const retry = useRetryJob();
  const library = useLibrary();
  const [inspected, setInspected] = useState<LibraryTrack | null>(null);
  const [deleting, setDeleting] = useState<LibraryTrack | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (jobs.length === 0) {
    return <p className="text-sm text-muted">{t("queue.empty")}</p>;
  }

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const trackById = new Map((library.data ?? []).map((track) => [track.id, track]));
  const libraryLoaded = library.data != null;
  const libraryTrackFor = (itemId: number | null) =>
    itemId != null && libraryLoaded ? trackById.get(itemId) : undefined;

  const inspectActions = (track: LibraryTrack | undefined) =>
    track && (
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
    );

  return (
    <>
      <Table aria-label={t("queue.heading")}>
        {/* Default table content clips overflow with no scrollbar; without this,
         * a wide row (e.g. the retry button's icon+label) silently hides the
         * actions column instead of squeezing or scrolling to it. */}
        <Table.ScrollContainer>
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
            {/* Static children (not the `items` render-prop): album rows expand
             * into per-track child rows, which the collection API cannot express;
             * static rows also re-render normally, so no `dependencies` hack. */}
            <Table.Body>
              {jobs.flatMap((job) => {
                const isExpanded = job.kind === "album" && expanded.has(job.id);
                const jobLibraryTrack = libraryTrackFor(
                  job.status === "done" ? (job.report?.itemId ?? null) : null,
                );
                const rows = [
                  <Table.Row id={job.id} key={job.id}>
                    <Table.Cell>
                      <TrackCell
                        job={job}
                        isExpanded={isExpanded}
                        onToggle={() => toggleExpanded(job.id)}
                      />
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
                      <MetadataStateCell job={job} enrichStages={enrichStages} />
                    </Table.Cell>
                    <Table.Cell>
                      {job.status === "done" && job.report?.itemId != null && libraryLoaded ? (
                        <LibraryChip track={jobLibraryTrack} />
                      ) : (
                        <span className="text-sm text-muted">—</span>
                      )}
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
                        {inspectActions(jobLibraryTrack)}
                      </div>
                    </Table.Cell>
                  </Table.Row>,
                ];

                if (isExpanded) {
                  rows.push(
                    ...job.tracks.map((track) => {
                      const rowId = `${job.id}:${track.index}`;
                      const trackLibraryTrack = libraryTrackFor(
                        track.status === "done" ? track.itemId : null,
                      );
                      return (
                        <Table.Row id={rowId} key={rowId}>
                          <Table.Cell>
                            <AlbumTrackCell track={track} />
                          </Table.Cell>
                          <Table.Cell>
                            <TrackDownloadStateCell
                              track={track}
                              percent={track.status === "downloading" ? downloadPercent : null}
                            />
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-sm text-muted">—</span>
                          </Table.Cell>
                          <Table.Cell>
                            <TrackMatchCell track={track} />
                          </Table.Cell>
                          <Table.Cell>
                            <TrackMetadataCell
                              track={track}
                              stage={
                                job.status === "enriching" && track.itemId != null
                                  ? enrichStages[track.itemId]
                                  : undefined
                              }
                            />
                          </Table.Cell>
                          <Table.Cell>
                            {/* A dropped duplicate's item no longer exists: the
                             * "removed from library" chip would be misleading. */}
                            {track.status === "done" &&
                            track.itemId != null &&
                            track.duplicateOf == null &&
                            libraryLoaded ? (
                              <LibraryChip track={trackLibraryTrack} />
                            ) : (
                              <span className="text-sm text-muted">—</span>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex items-center justify-end gap-1">
                              {inspectActions(trackLibraryTrack)}
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      );
                    }),
                  );
                }

                return rows;
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <MetadataDrawer track={inspected} onClose={() => setInspected(null)} />
      <DeleteTrackDialog track={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
