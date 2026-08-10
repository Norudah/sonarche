import { ChevronDown, Square } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { DownloadJob } from "@/features/download/api";
import { JobArtwork } from "@/features/download/activity/JobArtwork";
import { JobDetail } from "@/features/download/activity/JobDetail";
import { jobOutcome, OUTCOME_TONE } from "@/features/download/activity/outcome";
import { JobVerdict } from "@/features/download/activity/JobVerdict";
import { jobProgress, STAGE_WEIGHTS } from "@/features/download/activity/progress";
import { useProgressLabel } from "@/features/download/activity/useProgressLabel";
import type { EnrichStage } from "@/features/download/hooks";
import { jobDestination, jobPresence } from "@/features/download/queue/library";
import { canRetry } from "@/features/download/queue/pipeline";
import { AlbumRowActions, RowActions } from "@/features/download/queue/RowActions";
import type { LibraryTrack } from "@/features/library/api";
import { formatDuration } from "@/shared/lib/format";
import { springs } from "@/shared/motion/tokens";
import { Swap } from "@/shared/motion/Swap";
import { PipelineRail, type RailTone } from "@/shared/ui/PipelineRail";

/** The library lookups the card needs, bundled so the feed can hand one stable
 * object down instead of three separate callbacks it would have to memoise. */
export interface LibraryLookup {
  trackFor: (itemId: number | null) => LibraryTrack | undefined;
  has: (itemId: number) => boolean;
  isLoaded: boolean;
}

export interface JobCardProps {
  job: DownloadJob;
  /** Byte progress of the one job downloading right now; null for every other. */
  downloadPercent: number | null;
  /** Per-item enrich stages of the one job identifying right now. */
  enrichStages: Record<number, EnrichStage>;
  library: LibraryLookup;
  /** Queued while the user was watching — it announces itself on arrival. */
  isNew: boolean;
  onEdit: (track: LibraryTrack) => void;
  onDelete: (track: LibraryTrack) => void;
  onDeleteAlbum: (job: DownloadJob) => void;
  onRetry: (id: string) => void;
  isRetrying: boolean;
  onCancel: (id: string) => void;
  isCancelling: boolean;
}

/** Cover art the enrich step produced, once any of the job's items carries one;
 * until then the card keeps the YouTube thumbnail it was queued with. */
function coverOf(job: DownloadJob, library: LibraryLookup): string | null {
  if (job.kind !== "album") return library.trackFor(job.report?.itemId ?? null)?.artUrl ?? null;
  for (const track of job.tracks) {
    const art = library.trackFor(track.itemId)?.artUrl;
    if (art) return art;
  }
  return null;
}

function JobCardImpl({
  job,
  downloadPercent,
  enrichStages,
  library,
  isNew,
  onEdit,
  onDelete,
  onDeleteAlbum,
  onRetry,
  isRetrying,
  onCancel,
  isCancelling,
}: JobCardProps) {
  const { t } = useTranslation("download");
  const labelOf = useProgressLabel();
  const [isOpen, setIsOpen] = useState(false);

  const isAlbum = job.kind === "album";
  const outcome = jobOutcome(job);
  const href = jobDestination(job, library.trackFor);
  /** Whether what this job filed is still in the library — the one fact the
   * history rows kept behind a click, and the reason people read "recent" as
   * "in my library". Settled jobs only; silent until the library has loaded. */
  const presence = library.isLoaded ? jobPresence(job, library.has) : null;
  /** The single's own library item — what its row actions act on. */
  const landed = isAlbum ? undefined : library.trackFor(job.status === "done" ? (job.report?.itemId ?? null) : null);

  const enrichedCount =
    job.status === "enriching"
      ? job.tracks.filter((track) => track.itemId != null && enrichStages[track.itemId] === "track_done").length
      : null;
  const progress = jobProgress(job, downloadPercent, enrichedCount);

  /**
   * A job actually being worked on gets the full treatment: a lifted surface,
   * larger artwork, and the rail. Read off the phase rather than passed in, so
   * the Downloads feed and the History list cannot disagree about which of
   * their rows is live — a queued job has nothing to show but its name, and a
   * finished one has its verdict.
   */
  const isActive = progress.phase === "download" || progress.phase === "import" || progress.phase === "enrich";

  const tone: RailTone = outcome ? OUTCOME_TONE[outcome.kind] : "accent";

  /**
   * The line under the title, and the payoff of the whole pipeline.
   *
   * While the job runs it describes the *download*: a playlist of twelve, an
   * unknown artist. Once the record is filed it describes the *record*: artist,
   * album, year — read back from the library rather than from the video. That
   * rewrite is the app doing its job, stated in one line, which is why it is
   * animated rather than swapped silently.
   *
   * Only on completion, never mid-run: an album's tracks reach the library one
   * by one, and a subtitle that re-wrote itself at each import would twitch for
   * the length of the download instead of landing once.
   */
  const filed =
    job.status === "done"
      ? isAlbum
        ? job.tracks.map((track) => library.trackFor(track.itemId)).find((track) => track != null)
        : landed
      : undefined;

  const subtitle = filed
    ? [
        isAlbum ? filed.albumArtist || filed.artist : filed.artist,
        filed.album,
        filed.year,
        isAlbum && job.tracks.length > 0 ? t("queue.trackCount", { count: job.tracks.length }) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : [
        isAlbum ? t("queue.kindAlbum") : t("queue.kindSingle"),
        job.artist ?? t("unknownArtist"),
        isAlbum && job.tracks.length > 0
          ? t("queue.trackCount", { count: job.tracks.length })
          : job.duration != null
            ? formatDuration(job.duration)
            : null,
      ]
        .filter(Boolean)
        .join(" · ");

  const title = job.title ?? job.url;
  const albumTrackIds = job.tracks
    .filter((track) => track.duplicateOf == null)
    .map((track) => track.itemId)
    .filter((itemId): itemId is number => itemId != null && library.has(itemId));

  return (
    <article
      id={job.id}
      className={
        // Lifted and white while it works, flush with its tray once it is
        // filed: the two registers have to differ by more than a size, or a
        // list of finished rows and the one live card read as the same object.
        // An unfolded row borrows the same lift — its panel is several lines
        // tall, and on the bare tray it would read as loose text between rows.
        (isActive
          ? "rounded-2xl bg-surface p-4 shadow-sm "
          : isOpen
            ? "rounded-xl bg-surface px-3 py-2.5 shadow-sm "
            : "rounded-xl px-3 py-2.5 transition-colors hover:bg-default/50 ") + (isNew ? "card-reveal" : "")
      }
    >
      <div className="flex items-center gap-3">
        {href ? (
          <Link to={href} aria-label={t("queue.openInLibrary")} className="shrink-0 rounded-xl outline-none">
            <JobArtwork
              coverUrl={coverOf(job, library)}
              thumbnail={job.thumbnail}
              isAlbum={isAlbum}
              isSettled={job.status === "done"}
              size={isActive ? "lg" : "sm"}
            />
          </Link>
        ) : (
          <JobArtwork
            coverUrl={coverOf(job, library)}
            thumbnail={job.thumbnail}
            isAlbum={isAlbum}
            isSettled={job.status === "done"}
            size={isActive ? "lg" : "sm"}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className={"min-w-0 truncate font-semibold " + (isActive ? "text-[0.9375rem]" : "text-sm")}>
            {href ? (
              <Link
                to={href}
                className="rounded-sm underline-offset-2 outline-none hover:text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {title}
              </Link>
            ) : (
              title
            )}
          </p>

          <Swap swapKey={subtitle} className="block min-w-0 truncate text-xs text-muted">
            {subtitle}
          </Swap>

          {isActive && (
            <div className="mt-1.5 flex flex-col gap-1.5">
              <PipelineRail
                fills={progress.fills}
                weights={STAGE_WEIGHTS}
                activeIndex={progress.activeIndex}
                failedIndex={progress.failedIndex}
                tone={tone}
                label={labelOf(progress)}
              />
              <p className="text-[0.6875rem] tabular-nums text-accent">{labelOf(progress)}</p>
            </div>
          )}

          {job.status === "failed" && job.error && (
            <p className="truncate text-xs text-danger" title={job.error}>
              {job.error}
            </p>
          )}
        </div>

        {/* The status rail: a fixed right-aligned column, so every row's answer
            to "where does this stand" lands on the same vertical line whatever
            actions the row happens to carry. Hidden on the card in flight — it
            says all this under its own rail. */}
        {!isActive && (
          <div className="flex w-40 shrink-0 flex-col items-end gap-0.5">
            {/* One slot, two readings: a finished job states its verdict, a job
                still in line states what it is waiting on. */}
            {outcome ? (
              <JobVerdict outcome={outcome} source={outcome.kind === "matched" ? outcome.source : null} />
            ) : (
              <span className="text-[0.8125rem] whitespace-nowrap text-muted">
                {t(`activity.phase.${progress.phase}`)}
              </span>
            )}
            {/* The verdict says how the download went; this says whether its
                result is still in the library. The rows are a history — they
                stay whatever happens to the files — so the presence has to be
                readable without unfolding anything. */}
            {presence && (
              <span className="text-[0.6875rem] whitespace-nowrap text-muted">
                {t(`activity.presence.${presence}`)}
              </span>
            )}
          </div>
        )}

        {/* Sized to its widest set per register: the stop button while the job
            can still be stopped, play + menu once it is settled. Fixed, so the
            menus and chevrons of a section land on one vertical line. */}
        <div
          className={"flex shrink-0 items-center justify-end gap-1 " + (isActive || !outcome ? "w-32" : "w-[4.5rem]")}
        >
          {/* Queued or working: the one thing the user can still change about
              this job is whether it keeps going. Inline where every other verb
              moved into the menu, because a stop is reached for while something
              is happening — it cannot sit behind a click. */}
          {(job.status === "queued" || isActive) && (
            <button
              type="button"
              onClick={() => onCancel(job.id)}
              disabled={isCancelling}
              className="flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted transition-colors outline-none hover:bg-default/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-40"
            >
              <Square className="size-3.5" />
              {t("queue.cancel")}
            </button>
          )}

          {isAlbum ? (
            <AlbumRowActions
              dense
              trackIds={albumTrackIds}
              sourceUrl={job.url}
              libraryHref={href}
              onDelete={() => onDeleteAlbum(job)}
              onRetry={canRetry(job) ? () => onRetry(job.id) : undefined}
              isRetrying={isRetrying}
            />
          ) : (
            <RowActions
              dense
              track={landed}
              sourceUrl={job.url}
              onEdit={onEdit}
              onDelete={onDelete}
              onRetry={canRetry(job) ? () => onRetry(job.id) : undefined}
              isRetrying={isRetrying}
            />
          )}
        </div>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            aria-expanded={isOpen}
            aria-label={isOpen ? t("activity.collapse") : t("activity.expand")}
            onClick={() => setIsOpen((open) => !open)}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors outline-none hover:bg-default/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <motion.span initial={false} animate={{ rotate: isOpen ? 180 : 0 }} transition={springs.snappy}>
              <ChevronDown className="size-4" />
            </motion.span>
          </button>
        </div>
      </div>

      {/* Height, not opacity alone: the cards under this one have to move out of
          the way, and a panel that fades in on top of them reads as a popover. */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.soft}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <JobDetail
                job={job}
                libraryTrackFor={library.trackFor}
                isInLibrary={library.has}
                isLibraryLoaded={library.isLoaded}
                enrichStages={enrichStages}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

/**
 * Memoised, and not as a precaution: the page re-renders on every `jobs:updated`
 * event, which during an album download is several times a second. Only the job
 * that changed gets a new object out of the query cache, so every other card
 * bails out here instead of re-running its progress maths and its subtitle.
 */
export const JobCard = memo(JobCardImpl);
