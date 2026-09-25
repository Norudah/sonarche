import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { DownloadJob } from "@/features/download/api";
import { JobActions } from "@/features/download/activity/JobActions";
import { JobTrackRow, TRACK_GRID } from "@/features/download/activity/JobTrackRow";
import type { EnrichStage } from "@/features/download/hooks";
import { AttemptDots } from "@/features/download/activity/StepMarkers";
import { jobAttempts } from "@/features/download/queue/attempts";
import { jobPresence } from "@/features/download/queue/library";
import { formatTags, jobTags } from "@/features/download/queue/tags";
import type { LibraryTrack } from "@/features/library/api";
// The library's category labels, not a copy.
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">{label}</dt>
      <dd className="truncate text-[0.8125rem]">{children}</dd>
    </div>
  );
}

interface JobDetailProps {
  job: DownloadJob;
  libraryTrackFor: (itemId: number | null) => LibraryTrack | undefined;
  isInLibrary: (itemId: number) => boolean;
  isLibraryLoaded: boolean;
  enrichStages: Record<number, EnrichStage>;
  onEdit: (track: LibraryTrack) => void;
  onDelete: (track: LibraryTrack) => void;
}

/** The details behind a card's verdict, plus the playlist for albums. */
export function JobDetail({
  job,
  libraryTrackFor,
  isInLibrary,
  isLibraryLoaded,
  enrichStages,
  onEdit,
  onDelete,
}: JobDetailProps) {
  const { t } = useTranslation("download");
  const categoryLabel = useCategoryLabel();
  const isAlbum = job.kind === "album" && job.tracks.length > 0;
  const isSettled = job.status === "done" || job.status === "failed" || job.status === "cancelled";
  const tags = jobTags(job);

  const presence = isLibraryLoaded ? jobPresence(job, { has: isInLibrary, trackFor: libraryTrackFor }) : null;

  const source = isAlbum
    ? job.tracks.find((track) => track.report?.source)?.report?.source
    : (job.report?.source ?? null);

  return (
    <div className="flex flex-col gap-4 border-t border-separator/50 pt-3">
      {/* Auto-fit: singles and albums show different facts. */}
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-x-6 gap-y-3">
        <Fact label={t("queue.colMatch")}>{source ?? <span className="text-muted">{t("queue.matchNone")}</span>}</Fact>

        <Fact label={t("queue.colTags")}>
          {tags ? (
            <span className={`flex items-center gap-1.5 ${tags.provisional ? "text-warning" : ""}`}>
              {tags.provisional && <TriangleAlert className="size-3.5 shrink-0" />}
              <span className="tabular-nums">{formatTags(tags)}</span>
            </span>
          ) : (
            <span className="text-muted">{t("queue.noReport")}</span>
          )}
        </Fact>

        {/* Per track for albums. */}
        {!isAlbum && (
          <Fact label={t("activity.detail.cover")}>
            {job.report?.coverSource ?? <span className="text-muted">{t("queue.matchNone")}</span>}
          </Fact>
        )}

        {/* Short label; the full meaning is on the dots' aria-label. */}
        {!isAlbum && (
          <Fact label={t("activity.detail.attempts")}>
            <AttemptDots outcomes={jobAttempts(job)} label={t("queue.attempts")} />
          </Fact>
        )}

        {/* Same wording as the card's label. */}
        <Fact label={t("queue.colLibrary")}>
          {job.undoneAt != null ? (
            t("activity.presence.undone")
          ) : presence ? (
            t(`activity.presence.${presence}`)
          ) : (
            <span className="text-muted">{t(isSettled ? "activity.presence.nothing" : "queue.awaiting")}</span>
          )}
        </Fact>

        {job.category && <Fact label={t("activity.detail.category")}>{categoryLabel(job.category)}</Fact>}
      </dl>

      {/* Unavailable slots: the set has gaps the listing can't name. */}
      {job.unavailable > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-dashed border-warning/45 bg-warning-soft px-3 py-2.5 text-[0.75rem] leading-snug text-warning">
          <TriangleAlert className="mt-px size-3.5 shrink-0" />
          {t("activity.detail.unavailable", { count: job.unavailable })}
        </p>
      )}

      {isAlbum && (
        <div className="flex flex-col">
          <div
            className={`${TRACK_GRID} px-2 pb-1.5 text-[0.6875rem] font-semibold tracking-wider text-muted uppercase`}
          >
            <span className="text-right">#</span>
            <span>{t("activity.detail.track")}</span>
            <span>{t("queue.colPipeline")}</span>
            <span>{t("queue.colMatch")}</span>
            <span />
            <span />
          </div>
          {job.tracks.map((track) => (
            <JobTrackRow
              key={track.index}
              track={track}
              libraryTrack={libraryTrackFor(track.status === "done" ? track.itemId : null)}
              isEnriched={track.itemId != null && enrichStages[track.itemId] === "track_done"}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {isSettled && (
        <JobActions
          job={job}
          // Library actions need something still in the library.
          canUndo={job.undoneAt == null && (presence === "full" || presence === "partial")}
        />
      )}
    </div>
  );
}
