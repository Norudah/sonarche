import { Table } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { DownloadJob } from "@/features/download/api";
import { type EnrichStage, useRetryJob } from "@/features/download/hooks";
import { JobLibraryCell, TrackLibraryCell } from "@/features/download/queue/LibraryCell";
import { JobMatchCell, TrackMatchCell } from "@/features/download/queue/MatchCell";
import { JobMediaCell, TrackMediaCell } from "@/features/download/queue/MediaCell";
import { JobPipelineCell, TrackPipelineCell } from "@/features/download/queue/PipelineCell";
import { AlbumRowActions, RowActions } from "@/features/download/queue/RowActions";
import { JobTagsCell, TrackTagsCell } from "@/features/download/queue/TagsCell";
import type { LibraryTrack } from "@/features/library/api";
import { type AlbumDeletion, DeleteAlbumDialog } from "@/features/library/DeleteAlbumDialog";
import { DeleteTrackDialog } from "@/features/library/DeleteTrackDialog";
import { useLibrary } from "@/features/library/hooks";
import { MetadataDrawer } from "@/features/library/MetadataDrawer";

/* The `secondary` variant renders the header as a detached rounded pill; here it
 * has to read as the top band of one bordered card, hence the squared corners. */
const COLUMN =
  "rounded-none! border-b border-separator/60 py-3 text-[11px] font-semibold tracking-wider uppercase";

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
  const [deletingAlbum, setDeletingAlbum] = useState<AlbumDeletion | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (jobs.length === 0) {
    return (
      <p className="rounded-2xl border border-separator/60 bg-surface px-6 py-10 text-center text-sm text-muted">
        {t("queue.empty")}
      </p>
    );
  }

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const trackById = new Map((library.data ?? []).map((track) => [track.id, track]));
  const libraryLoaded = library.data != null;
  const libraryTrackFor = (itemId: number | null) =>
    itemId != null && libraryLoaded ? trackById.get(itemId) : undefined;
  const isInLibrary = (itemId: number) => trackById.has(itemId);

  /** The album's items that are still in the library — a track dropped as a
   * duplicate or already deleted has nothing left to remove. */
  const albumTrackIds = (job: DownloadJob) =>
    job.tracks
      .filter((track) => track.duplicateOf == null)
      .map((track) => track.itemId)
      .filter((itemId): itemId is number => itemId != null && isInLibrary(itemId));

  /** Cover art the enrich step produced, once any of the job's items carries
   * one; until then the row keeps the YouTube thumbnail it was queued with. */
  const coverFor = (job: DownloadJob): string | null => {
    if (job.kind !== "album") return libraryTrackFor(job.report?.itemId ?? null)?.artUrl ?? null;
    for (const track of job.tracks) {
      const art = libraryTrackFor(track.itemId)?.artUrl;
      if (art) return art;
    }
    return null;
  };

  return (
    <>
      <Table
        aria-label={t("queue.heading")}
        variant="secondary"
        className="overflow-hidden rounded-2xl border border-separator/60 bg-surface"
      >
        {/* Default table content clips overflow with no scrollbar; without this,
         * a wide row (e.g. the retry button's icon+label) silently hides the
         * actions column instead of squeezing or scrolling to it. */}
        <Table.ScrollContainer>
          {/* Tighter gutters than the HeroUI default: six columns at px-4 push
           * the table past the 1080px minimum window width. */}
          <Table.Content aria-label={t("queue.heading")} className="[&_td]:px-3 [&_th]:px-3">
            <Table.Header>
              <Table.Column isRowHeader className={`w-full ${COLUMN}`}>
                {t("queue.colMedia")}
              </Table.Column>
              <Table.Column className={COLUMN}>{t("queue.colPipeline")}</Table.Column>
              <Table.Column className={COLUMN}>{t("queue.colMatch")}</Table.Column>
              <Table.Column className={COLUMN}>{t("queue.colTags")}</Table.Column>
              <Table.Column className={COLUMN}>{t("queue.colLibrary")}</Table.Column>
              <Table.Column className={COLUMN}>
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
                const enrichedCount =
                  job.status === "enriching"
                    ? job.tracks.filter(
                        (track) =>
                          track.itemId != null && enrichStages[track.itemId] === "track_done",
                      ).length
                    : null;

                const rows = [
                  <Table.Row id={job.id} key={job.id}>
                    <Table.Cell>
                      <JobMediaCell
                        job={job}
                        coverUrl={coverFor(job)}
                        isExpanded={isExpanded}
                        onToggle={() => toggleExpanded(job.id)}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <JobPipelineCell
                        job={job}
                        downloadPercent={job.status === "downloading" ? downloadPercent : null}
                        enrichedCount={enrichedCount}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <JobMatchCell job={job} />
                    </Table.Cell>
                    <Table.Cell>
                      <JobTagsCell job={job} />
                    </Table.Cell>
                    <Table.Cell>
                      <JobLibraryCell
                        job={job}
                        isInLibrary={isInLibrary}
                        isLibraryLoaded={libraryLoaded}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      {job.kind === "album" ? (
                        <AlbumRowActions
                          trackIds={albumTrackIds(job)}
                          sourceUrl={job.url}
                          onDelete={() =>
                            setDeletingAlbum({
                              title: job.title ?? "",
                              trackIds: albumTrackIds(job),
                            })
                          }
                          onRetry={
                            job.status === "failed" ? () => retry.mutate(job.id) : undefined
                          }
                          isRetrying={retry.isPending}
                        />
                      ) : (
                        <RowActions
                          track={jobLibraryTrack}
                          sourceUrl={job.url}
                          onInspect={setInspected}
                          onDelete={setDeleting}
                          onRetry={
                            job.status === "failed" ? () => retry.mutate(job.id) : undefined
                          }
                          isRetrying={retry.isPending}
                        />
                      )}
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
                        // The variant forces transparent cells, so the child-row
                        // tint has to be applied on the cells themselves.
                        <Table.Row id={rowId} key={rowId} className="[&_td]:bg-surface-secondary/50">
                          <Table.Cell>
                            <TrackMediaCell track={track} />
                          </Table.Cell>
                          <Table.Cell>
                            <TrackPipelineCell
                              track={track}
                              isEnriched={
                                track.itemId != null &&
                                enrichStages[track.itemId] === "track_done"
                              }
                            />
                          </Table.Cell>
                          <Table.Cell>
                            <TrackMatchCell track={track} />
                          </Table.Cell>
                          <Table.Cell>
                            <TrackTagsCell track={track} />
                          </Table.Cell>
                          <Table.Cell>
                            <TrackLibraryCell
                              itemId={track.itemId}
                              isDuplicate={track.duplicateOf != null}
                              isDone={track.status === "done"}
                              isInLibrary={isInLibrary}
                              isLibraryLoaded={libraryLoaded}
                            />
                          </Table.Cell>
                          <Table.Cell>
                            <RowActions
                              track={trackLibraryTrack}
                              sourceUrl={track.url}
                              onInspect={setInspected}
                              onDelete={setDeleting}
                            />
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
      <DeleteAlbumDialog album={deletingAlbum} onClose={() => setDeletingAlbum(null)} />
    </>
  );
}
