import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { DownloadJob } from "@/features/download/api";
import { JobTrackRow, TRACK_GRID } from "@/features/download/activity/JobTrackRow";
import type { EnrichStage } from "@/features/download/hooks";
import { AttemptDots } from "@/features/download/activity/StepMarkers";
import { jobAttempts } from "@/features/download/queue/attempts";
import { albumPresence, type LibraryPresence } from "@/features/download/queue/library";
import { formatTags, jobTags } from "@/features/download/queue/tags";
import type { LibraryTrack } from "@/features/library/api";
// The taxonomy the download composer offers is the library's own axis, and its
// canonical values must not exist twice — a second list would silently drift
// out of step with the one the Categories page groups by.
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">{label}</dt>
      <dd className="truncate text-[0.8125rem]">{children}</dd>
    </div>
  );
}

const PRESENCE_KEY: Record<LibraryPresence, string> = {
  full: "queue.inLibrary",
  partial: "queue.partiallyInLibrary",
  none: "queue.removedFromLibrary",
};

interface JobDetailProps {
  job: DownloadJob;
  libraryTrackFor: (itemId: number | null) => LibraryTrack | undefined;
  isInLibrary: (itemId: number) => boolean;
  isLibraryLoaded: boolean;
  enrichStages: Record<number, EnrichStage>;
  onInspect: (track: LibraryTrack) => void;
  onDelete: (track: LibraryTrack) => void;
}

/**
 * What the card's one-word verdict left out.
 *
 * The history table spreads match, tags, library presence and retries across
 * four permanent columns; here they are the answer to "what actually happened",
 * shown only to whoever asks. An album adds its playlist under them, which is
 * the reason to unfold a card at all — the same set the album page shows, minus
 * everything the download itself has no opinion on.
 */
export function JobDetail({
  job,
  libraryTrackFor,
  isInLibrary,
  isLibraryLoaded,
  enrichStages,
  onInspect,
  onDelete,
}: JobDetailProps) {
  const { t } = useTranslation("download");
  const categoryLabel = useCategoryLabel();
  const isAlbum = job.kind === "album" && job.tracks.length > 0;
  const tags = jobTags(job);

  const presence = isLibraryLoaded
    ? isAlbum
      ? albumPresence(job, isInLibrary)
      : job.report?.itemId != null
        ? isInLibrary(job.report.itemId)
          ? "full"
          : "none"
        : null
    : null;

  const source = isAlbum
    ? job.tracks.find((track) => track.report?.source)?.report?.source
    : (job.report?.source ?? null);

  return (
    <div className="flex flex-col gap-4 border-t border-separator/50 pt-3">
      {/* Auto-fit rather than a column count: a single reports two facts an
          album cannot (its cover source, its retries), so the same fixed grid
          would leave an album with holes and wrap a single onto a ragged second
          row. */}
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

        {/* Per track on an album, where a single cover answers for the set only
            by accident; the aggregate would be a half-truth. */}
        {!isAlbum && (
          <Fact label={t("activity.detail.cover")}>
            {job.report?.coverSource ?? <span className="text-muted">{t("queue.matchNone")}</span>}
          </Fact>
        )}

        {/* Short label, full meaning on the dots' own aria-label: "Tentatives de
            téléchargement" wraps to two lines and drags the whole grid down. */}
        {!isAlbum && (
          <Fact label={t("activity.detail.attempts")}>
            <AttemptDots outcomes={jobAttempts(job)} label={t("queue.attempts")} />
          </Fact>
        )}

        <Fact label={t("queue.colLibrary")}>
          {presence ? t(PRESENCE_KEY[presence]) : <span className="text-muted">{t("queue.awaiting")}</span>}
        </Fact>

        {/* Only when the job carried one: an absent category is the ordinary
            case, not a blank to apologise for. */}
        {job.category && <Fact label={t("activity.detail.category")}>{categoryLabel(job.category)}</Fact>}
      </dl>

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
              onInspect={onInspect}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
