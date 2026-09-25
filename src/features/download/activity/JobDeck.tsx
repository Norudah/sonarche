import { type ReactNode, useCallback, useMemo, useState } from "react";

import type { DownloadJob } from "@/features/download/api";
import { JobCard, type LibraryLookup } from "@/features/download/activity/JobCard";
import { type EnrichStage, useCancelJob, useRetryJob } from "@/features/download/hooks";
import { useNewJobIds } from "@/features/download/queue/useNewJobIds";
import type { LibraryTrack } from "@/features/library/api";
import { type AlbumDeletion, DeleteAlbumDialog, useAlbumDeleteGuard } from "@/features/library/DeleteAlbumDialog";
import { DeleteTrackDialog } from "@/features/library/DeleteTrackDialog";
import { useLibrary } from "@/features/library/hooks";
import { MetadataDrawer } from "@/features/library/MetadataDrawer";

/** Shared empty map so `JobCard`'s memo holds for cards not being identified. */
const NO_STAGES: Record<number, never> = {};

export interface JobSection {
  key: string;
  heading?: string;
  action?: ReactNode;
  jobs: DownloadJob[];
  /** Rows on a recessed tray, or directly on the page background. */
  onTray: boolean;
  empty?: ReactNode;
}

interface JobDeckProps {
  sections: JobSection[];
  downloadPercent: number | null;
  enrichStages: Record<number, EnrichStage>;
}

/** Job cards and their dialogs, shared by the Downloads and History pages so
 * both render rows identically. */
export function JobDeck({ sections, downloadPercent, enrichStages }: JobDeckProps) {
  const retry = useRetryJob();
  const cancel = useCancelJob();
  const libraryQuery = useLibrary();
  const mayDelete = useAlbumDeleteGuard();
  const [inspected, setInspected] = useState<LibraryTrack | null>(null);
  const [deleting, setDeleting] = useState<LibraryTrack | null>(null);
  const [deletingAlbum, setDeletingAlbum] = useState<AlbumDeletion | null>(null);

  const allJobs = useMemo(() => sections.flatMap((section) => section.jobs), [sections]);
  const newJobIds = useNewJobIds(allJobs.map((job) => job.id));

  // Rebuilt only when the library changes; this re-renders on every job event.
  const trackById = useMemo(
    () => new Map((libraryQuery.data ?? []).map((track) => [track.id, track])),
    [libraryQuery.data],
  );

  // Stable, so unchanged cards bail out of their memo.
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
  const onDeleteAlbum = useCallback(
    (job: DownloadJob) => {
      const trackIds = job.tracks
        .filter((track) => track.duplicateOf == null)
        .map((track) => track.itemId)
        .filter((itemId): itemId is number => itemId != null);
      // Resolve album ids so the delete guard can recognise a download's destination.
      const albumIds = [
        ...new Set(trackIds.map((id) => trackById.get(id)?.albumId).filter((id): id is number => id != null)),
      ];
      if (!mayDelete(albumIds)) return;
      setDeletingAlbum({ title: job.title ?? "", trackIds });
    },
    [mayDelete, trackById],
  );

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
                  // Only the working job has live figures.
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
