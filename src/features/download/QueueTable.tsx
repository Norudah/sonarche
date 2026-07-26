import { type CSSProperties, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { DownloadJob } from "@/features/download/api";
import { type EnrichStage, useRetryJob } from "@/features/download/hooks";
import { jobDestination } from "@/features/download/queue/library";
import { JobLibraryCell, TrackLibraryCell } from "@/features/download/queue/LibraryCell";
import { JobMatchCell, TrackMatchCell } from "@/features/download/queue/MatchCell";
import { JobMediaCell, TrackMediaCell } from "@/features/download/queue/MediaCell";
import { JobPipelineCell, TrackPipelineCell } from "@/features/download/queue/PipelineCell";
import { canRetry } from "@/features/download/queue/pipeline";
import { AlbumRowActions, RowActions } from "@/features/download/queue/RowActions";
import { JobTagsCell, TrackTagsCell } from "@/features/download/queue/TagsCell";
import { useNewJobIds } from "@/features/download/queue/useNewJobIds";
import type { LibraryTrack } from "@/features/library/api";
import { type AlbumDeletion, DeleteAlbumDialog } from "@/features/library/DeleteAlbumDialog";
import { DeleteTrackDialog } from "@/features/library/DeleteTrackDialog";
import { useLibrary } from "@/features/library/hooks";
import { MetadataDrawer } from "@/features/library/MetadataDrawer";

/* The same header and cell treatment as the album tracklist: labels on a filet,
 * rows as rounded pills that tint on hover, no bordered card boxing it all in.
 * The queue used HeroUI's `Table` with its grey banded header and full-width
 * grid borders, which read as a heavier, more "spreadsheet" table than anything
 * else in the app — the one screen that broke the family. Hand-rolled here for
 * the same reason `AlbumTrackList` is: album rows expand into per-track child
 * rows, a shape the collection API cannot express. */
const COLUMN = "px-3 pb-2 text-[0.6875rem] font-semibold tracking-wider text-muted uppercase";
const CELL = "px-3 py-2 align-middle";

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
  const newJobIds = useNewJobIds(jobs.map((job) => job.id));

  // Above the early return, where a hook has to live — and memoised because
  // this page re-renders on every job event, which during an album download is
  // several times a second, and rebuilding an index of the whole library each
  // time is the one thing here that scales with the library rather than the queue.
  const trackById = useMemo(() => new Map((library.data ?? []).map((track) => [track.id, track])), [library.data]);

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
      {/* `overflow-x-auto` stands in for HeroUI's ScrollContainer: a wide row
          scrolls to its actions column instead of clipping it silently. `min-w-0`
          is load-bearing — without it the table's min-content width propagates up
          the flex chain and widens the whole page past the viewport instead of
          scrolling here. */}
      <div className="min-w-0 overflow-x-auto">
        <table
          aria-label={t("queue.heading")}
          className="w-full min-w-[56rem] border-separate border-spacing-y-0.5 text-left"
        >
          <thead>
            <tr className="[&>th]:border-b [&>th]:border-separator/60">
              <th scope="col" className={`${COLUMN} w-full text-left`}>
                {t("queue.colMedia")}
              </th>
              <th scope="col" className={`${COLUMN} text-left`}>
                {t("queue.colPipeline")}
              </th>
              <th scope="col" className={`${COLUMN} text-left`}>
                {t("queue.colMatch")}
              </th>
              <th scope="col" className={`${COLUMN} text-left`}>
                {t("queue.colTags")}
              </th>
              <th scope="col" className={`${COLUMN} text-left`}>
                {t("queue.colLibrary")}
              </th>
              <th scope="col" className={COLUMN}>
                <span className="sr-only">{t("queue.colActions")}</span>
              </th>
            </tr>
          </thead>
          {/* Album rows expand into per-track child rows — a shape the collection
              API cannot express, hence the flat map over static rows. */}
          <tbody>
            {jobs.flatMap((job) => {
              const isExpanded = job.kind === "album" && expanded.has(job.id);
              const jobLibraryTrack = libraryTrackFor(job.status === "done" ? (job.report?.itemId ?? null) : null);
              const enrichedCount =
                job.status === "enriching"
                  ? job.tracks.filter((track) => track.itemId != null && enrichStages[track.itemId] === "track_done")
                      .length
                  : null;

              const rows = [
                // A job the user just queued fades up out of an accent wash; the
                // history it lands on top of stays still. Rounded ends + hover
                // tint are the album tracklist's row, verbatim.
                <tr
                  id={job.id}
                  key={job.id}
                  className={
                    "[&>td]:transition-colors [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl hover:[&>td]:bg-default/40 " +
                    (newJobIds.has(job.id) ? "row-reveal" : "")
                  }
                >
                  <td className={CELL}>
                    <JobMediaCell
                      job={job}
                      coverUrl={coverFor(job)}
                      href={jobDestination(job, libraryTrackFor)}
                      isExpanded={isExpanded}
                      onToggle={() => toggleExpanded(job.id)}
                    />
                  </td>
                  <td className={CELL}>
                    <JobPipelineCell
                      job={job}
                      downloadPercent={job.status === "downloading" ? downloadPercent : null}
                      enrichedCount={enrichedCount}
                    />
                  </td>
                  <td className={CELL}>
                    <JobMatchCell job={job} />
                  </td>
                  <td className={CELL}>
                    <JobTagsCell job={job} />
                  </td>
                  <td className={CELL}>
                    <JobLibraryCell job={job} isInLibrary={isInLibrary} isLibraryLoaded={libraryLoaded} />
                  </td>
                  <td className={CELL}>
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
                        onRetry={canRetry(job) ? () => retry.mutate(job.id) : undefined}
                        isRetrying={retry.isPending}
                      />
                    ) : (
                      <RowActions
                        track={jobLibraryTrack}
                        sourceUrl={job.url}
                        onInspect={setInspected}
                        onDelete={setDeleting}
                        onRetry={canRetry(job) ? () => retry.mutate(job.id) : undefined}
                        isRetrying={retry.isPending}
                      />
                    )}
                  </td>
                </tr>,
              ];

              if (isExpanded) {
                rows.push(
                  ...job.tracks.map((track, position) => {
                    const rowId = `${job.id}:${track.index}`;
                    const trackLibraryTrack = libraryTrackFor(track.status === "done" ? track.itemId : null);
                    return (
                      // Tinted so the child rows read as belonging to the album
                      // above. The stagger is capped: a 30-track album should not
                      // take three seconds to finish unfolding.
                      <tr
                        id={rowId}
                        key={rowId}
                        className="row-cascade [&>td]:bg-surface-secondary/50 [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl"
                        style={{ "--row-stagger": `${Math.min(position, 8) * 0.03}s` } as CSSProperties}
                      >
                        <td className={CELL}>
                          <TrackMediaCell track={track} />
                        </td>
                        <td className={CELL}>
                          <TrackPipelineCell
                            track={track}
                            isEnriched={track.itemId != null && enrichStages[track.itemId] === "track_done"}
                          />
                        </td>
                        <td className={CELL}>
                          <TrackMatchCell track={track} />
                        </td>
                        <td className={CELL}>
                          <TrackTagsCell track={track} />
                        </td>
                        <td className={CELL}>
                          <TrackLibraryCell
                            itemId={track.itemId}
                            isDuplicate={track.duplicateOf != null}
                            isDone={track.status === "done"}
                            isInLibrary={isInLibrary}
                            isLibraryLoaded={libraryLoaded}
                          />
                        </td>
                        <td className={CELL}>
                          <RowActions
                            track={trackLibraryTrack}
                            sourceUrl={track.url}
                            onInspect={setInspected}
                            onDelete={setDeleting}
                          />
                        </td>
                      </tr>
                    );
                  }),
                );
              }

              return rows;
            })}
          </tbody>
        </table>
      </div>

      <MetadataDrawer track={inspected} onClose={() => setInspected(null)} />
      <DeleteTrackDialog track={deleting} onClose={() => setDeleting(null)} onDeleted={() => setInspected(null)} />
      <DeleteAlbumDialog album={deletingAlbum} onClose={() => setDeletingAlbum(null)} />
    </>
  );
}
