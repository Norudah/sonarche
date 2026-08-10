import { type ReactNode, useCallback, useMemo, useState } from "react";

import type { DownloadJob } from "@/features/download/api";
import { JobCard, type LibraryLookup } from "@/features/download/activity/JobCard";
import { type EnrichStage, useCancelJob, useRetryJob } from "@/features/download/hooks";
import { useNewJobIds } from "@/features/download/queue/useNewJobIds";
import type { LibraryTrack } from "@/features/library/api";
import { type AlbumDeletion, DeleteAlbumDialog } from "@/features/library/DeleteAlbumDialog";
import { DeleteTrackDialog } from "@/features/library/DeleteTrackDialog";
import { useLibrary } from "@/features/library/hooks";
import { MetadataDrawer } from "@/features/library/MetadataDrawer";

/**
 * Stable empty map for every card that is not the one being identified.
 *
 * `enrichStages` changes several times a second while an album is being
 * matched, and a fresh `{}` per render would defeat `JobCard`'s memo for the
 * whole list exactly when the page is busiest. Only tracks sitting at
 * `imported` read these stages — a finished track reports from its own status —
 * so every other card can share one frozen object.
 */
const NO_STAGES: Record<number, never> = {};

export interface JobSection {
  key: string;
  /** Omitted on a page that is one list and says so in its own header. */
  heading?: string;
  /** A link or control aligned opposite the heading. */
  action?: ReactNode;
  jobs: DownloadJob[];
  /**
   * Rows grouped on a recessed tray, or standing free on the page background.
   *
   * The tray is the shelf a section's rows are filed onto: one tinted block
   * rather than a stack of loose accordions on the page, and the ground a live
   * card's white surface lifts off. Off only where a section's rows have no
   * shelf of their own to sit on.
   */
  onTray: boolean;
  /** Shown in place of the rows when the section has none. */
  empty?: ReactNode;
}

interface JobDeckProps {
  sections: JobSection[];
  /** Byte progress of the one job downloading right now. */
  downloadPercent: number | null;
  /** Per-item enrich stages of the one job identifying right now. */
  enrichStages: Record<number, EnrichStage>;
}

/**
 * The shared body of both download surfaces: job cards, plus the library
 * lookups and the dialogs they all reach for.
 *
 * One component for the Downloads feed and the History list, arranged into
 * sections by whichever page owns them. It exists because those two pages must
 * not drift into two different readings of the same row — which is what
 * happened when one was a card feed and the other a table.
 */
export function JobDeck({ sections, downloadPercent, enrichStages }: JobDeckProps) {
  const retry = useRetryJob();
  const cancel = useCancelJob();
  const libraryQuery = useLibrary();
  const [inspected, setInspected] = useState<LibraryTrack | null>(null);
  const [deleting, setDeleting] = useState<LibraryTrack | null>(null);
  const [deletingAlbum, setDeletingAlbum] = useState<AlbumDeletion | null>(null);

  const allJobs = useMemo(() => sections.flatMap((section) => section.jobs), [sections]);
  const newJobIds = useNewJobIds(allJobs.map((job) => job.id));

  // Rebuilt only when the library itself changes: this component re-renders on
  // every job event — several times a second during an album — and this is the
  // one thing here whose cost scales with the library rather than the queue.
  const trackById = useMemo(
    () => new Map((libraryQuery.data ?? []).map((track) => [track.id, track])),
    [libraryQuery.data],
  );

  // One stable object, so a card that did not change bails out of its memo.
  const library: LibraryLookup = useMemo(
    () => ({
      trackFor: (itemId) => (itemId != null ? trackById.get(itemId) : undefined),
      has: (itemId) => trackById.has(itemId),
      isLoaded: libraryQuery.data != null,
    }),
    [trackById, libraryQuery.data],
  );

  const onRetry = useCallback((id: string) => retry.mutate(id), [retry]);
  const onCancel = useCallback((id: string) => cancel.mutate(id), [cancel]);
  const onDeleteAlbum = useCallback((job: DownloadJob) => {
    setDeletingAlbum({
      title: job.title ?? "",
      trackIds: job.tracks
        .filter((track) => track.duplicateOf == null)
        .map((track) => track.itemId)
        .filter((itemId): itemId is number => itemId != null),
    });
  }, []);

  const cardProps = {
    library,
    onEdit: setInspected,
    onDelete: setDeleting,
    onDeleteAlbum,
    onRetry,
    isRetrying: retry.isPending,
    onCancel,
    isCancelling: cancel.isPending,
  };

  return (
    <>
      {sections.map((section) => (
        <section key={section.key} className="flex flex-col gap-2">
          {section.heading && (
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">{section.heading}</h2>
              {section.action}
            </div>
          )}

          {section.jobs.length === 0 ? (
            section.empty
          ) : (
            <div className={section.onTray ? "flex flex-col gap-1 rounded-2xl bg-tray p-1.5" : "flex flex-col gap-2"}>
              {section.jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isNew={newJobIds.has(job.id)}
                  // Only the job actually working has live figures to show; the
                  // ones behind it would otherwise borrow them.
                  downloadPercent={job.status === "downloading" ? downloadPercent : null}
                  enrichStages={job.status === "enriching" ? enrichStages : NO_STAGES}
                  {...cardProps}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      <MetadataDrawer track={inspected} onClose={() => setInspected(null)} />
      <DeleteTrackDialog track={deleting} onClose={() => setDeleting(null)} onDeleted={() => setInspected(null)} />
      <DeleteAlbumDialog album={deletingAlbum} onClose={() => setDeletingAlbum(null)} />
    </>
  );
}
