import { Check, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { ChangeSummary } from "@/features/library/albums/albumFields";
import { HERO_BUTTON_SECONDARY } from "@/features/library/heroButton";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";
import { FieldHelp } from "@/shared/ui/FieldHelp";
import { springs } from "@/shared/motion/tokens";

export type SaveFeedback = { kind: "saved"; tracks: number } | { kind: "failed" } | null;

/** How the last re-match ended: the loop's own counts, or a thrown call. */
export type RematchOutcome =
  { kind: "failed" } | { kind: "finished"; matched: number; done: number; total: number; cancelled: boolean } | null;

/**
 * The panel's action bar, and the one place that says what is pending.
 *
 * Re-match sits on the left, where it has always been — but it is now shut while
 * changes are waiting, and says why. It rewrites tags from MusicBrainz; running
 * it over a pending draft used to silently undo the match on save. While it
 * runs, the progress bar carries a Stop: the loop is sequential, so stopping is
 * honest — the track in flight finishes, the rest are not started.
 */
export function InspectFooter({
  summary,
  feedback,
  isSaving,
  isCollection,
  rematchProgress,
  rematchOutcome,
  isCancellingRematch,
  onRematch,
  onCancelRematch,
  onDiscard,
  onSave,
  onDismissFeedback,
}: {
  summary: ChangeSummary;
  feedback: SaveFeedback;
  isSaving: boolean;
  /** A collection has no release to be matched against: re-match is off, and
   * the footer says why instead of leaving a grey button to be wondered at. */
  isCollection: boolean;
  rematchProgress: { done: number; matched: number; total: number } | null;
  rematchOutcome: RematchOutcome;
  isCancellingRematch: boolean;
  onRematch: () => void;
  onCancelRematch: () => void;
  onDiscard: () => void;
  onSave: () => void;
  onDismissFeedback: () => void;
}) {
  const { t } = useTranslation("library");
  const isDirty = summary.fields > 0;
  const isRematching = rematchProgress != null;

  // A save's own feedback owns the line; the re-match verdict takes it back
  // once there is nothing pending — same precedence as the track footer.
  const line = feedback ?? rematchOutcome;
  const lineWash =
    line == null
      ? ""
      : line.kind === "failed"
        ? "bg-danger/8"
        : line.kind === "finished" && line.cancelled
          ? ""
          : "bg-success/10";

  return (
    <footer className="flex shrink-0 flex-col border-t border-separator bg-panel">
      <AnimatePresence>
        {line && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.snappy}
            className="overflow-hidden"
          >
            <div className={`flex items-center gap-2.5 px-5 py-2.5 text-[0.8125rem] text-foreground ${lineWash}`}>
              {line.kind === "failed" ? (
                <TriangleAlert className="size-4 shrink-0 text-danger" />
              ) : line.kind === "finished" && line.cancelled ? (
                <span className="size-2 shrink-0 rounded-full bg-muted/50" />
              ) : (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
              <span className="min-w-0">
                {line.kind === "saved" ? (
                  <strong className="font-semibold">{t("albumMetadata.saved", { count: line.tracks })}</strong>
                ) : line.kind === "failed" ? (
                  feedback ? (
                    <>
                      <strong className="font-semibold">{t("metadata.saveFailed")}</strong>{" "}
                      <span className="text-muted">{t("albumMetadata.saveFailedSafe")}</span>
                    </>
                  ) : (
                    t("albumMetadata.rematch.failed")
                  )
                ) : line.cancelled ? (
                  <span className="text-muted">{t("albumMetadata.rematch.stopped", line)}</span>
                ) : (
                  t("albums.rematchDone", line)
                )}
              </span>
              {feedback?.kind === "failed" && (
                <button
                  type="button"
                  onClick={onSave}
                  className="ml-auto shrink-0 cursor-pointer text-[0.8125rem] font-medium text-danger outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {t("albumMetadata.retry")}
                </button>
              )}
              {feedback?.kind === "saved" && (
                <button
                  type="button"
                  onClick={onDismissFeedback}
                  aria-label={t("metadata.close")}
                  className="ml-auto shrink-0 cursor-pointer rounded-full p-1 text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <Check className="size-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 px-5 py-3">
        <button
          type="button"
          disabled={isDirty || isRematching || isCollection}
          onClick={onRematch}
          className={`${HERO_BUTTON_SECONDARY} group/rematch shrink-0 cursor-pointer disabled:cursor-default disabled:opacity-55`}
        >
          {isRematching ? (
            <Loader2 className="size-4 animate-spin text-accent" />
          ) : (
            <Sparkles className="size-4 text-accent transition-transform duration-500 ease-out group-hover/rematch:rotate-180 motion-reduce:transition-none" />
          )}
          {isRematching ? t("albums.rematching") : t("albums.rematch")}
        </button>

        {isRematching ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="h-1 overflow-hidden rounded-full bg-default">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{
                    width: `${Math.round((rematchProgress.done / Math.max(rematchProgress.total, 1)) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-[0.6875rem] text-muted">{t("albumMetadata.rematch.progress", rematchProgress)}</p>
            </div>
            {/* Stopping waits for the track in flight — the label says so. */}
            <button
              type="button"
              disabled={isCancellingRematch}
              onClick={onCancelRematch}
              className={`${HERO_BUTTON_SECONDARY} shrink-0 cursor-pointer text-danger disabled:cursor-default disabled:opacity-55`}
            >
              {isCancellingRematch ? t("albumMetadata.rematch.stopping") : t("albumMetadata.rematch.stop")}
            </button>
          </div>
        ) : isCollection ? (
          <p className="min-w-0 flex-1 text-[0.6875rem] leading-snug text-muted/90">
            {t("albumMetadata.rematch.collection")}
          </p>
        ) : isDirty ? (
          <p className="min-w-0 flex-1 text-[0.6875rem] leading-snug text-muted/90">
            {t("albumMetadata.rematch.blocked")}
          </p>
        ) : (
          <FieldHelp
            label={t("metadata.help.open", { field: t("albums.rematch") })}
            text={t("metadata.help.rematch")}
          />
        )}

        {/* Actions only, pinned right. The pending count used to sit here and
            swap between "no changes" and a two-part sentence, shoving the
            buttons sideways on the first keystroke; it lives in the title bar
            now, where its width belongs to nothing else. */}
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <AnimatePresence>
            {isDirty && (
              <motion.button
                type="button"
                onClick={onDiscard}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={springs.bouncy}
                className={`${HERO_BUTTON_SECONDARY} shrink-0 cursor-pointer`}
              >
                {t("metadata.cancel")}
              </motion.button>
            )}
          </AnimatePresence>

          <PrimaryButton onPress={onSave} isPending={isSaving} isDisabled={!isDirty}>
            {isSaving ? t("metadata.saving") : t("metadata.save")}
          </PrimaryButton>
        </div>
      </div>
    </footer>
  );
}
