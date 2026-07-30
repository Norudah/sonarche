import { Check, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { ChangeSummary } from "@/features/library/albums/albumFields";
import { HERO_BUTTON_SECONDARY } from "@/features/library/heroButton";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";
import { FieldHelp } from "@/shared/ui/FieldHelp";
import { springs } from "@/shared/motion/tokens";

export type SaveFeedback = { kind: "saved"; tracks: number } | { kind: "failed" } | null;

/**
 * The panel's action bar, and the one place that says what is pending.
 *
 * Re-match sits on the left, where it has always been — but it is now shut while
 * changes are waiting, and says why. It rewrites tags from MusicBrainz; running
 * it over a pending draft used to silently undo the match on save.
 */
export function InspectFooter({
  summary,
  feedback,
  isSaving,
  rematchProgress,
  onRematch,
  onDiscard,
  onSave,
  onDismissFeedback,
}: {
  summary: ChangeSummary;
  feedback: SaveFeedback;
  isSaving: boolean;
  rematchProgress: { done: number; matched: number; total: number } | null;
  onRematch: () => void;
  onDiscard: () => void;
  onSave: () => void;
  onDismissFeedback: () => void;
}) {
  const { t } = useTranslation("library");
  const isDirty = summary.fields > 0;
  const isRematching = rematchProgress != null;

  return (
    <footer className="flex shrink-0 flex-col border-t border-separator bg-panel">
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.snappy}
            className="overflow-hidden"
          >
            <div
              className={`flex items-center gap-2.5 px-5 py-2.5 text-[0.8125rem] ${
                feedback.kind === "saved" ? "bg-success/10 text-foreground" : "bg-danger/8 text-foreground"
              }`}
            >
              {feedback.kind === "saved" ? (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              ) : (
                <TriangleAlert className="size-4 shrink-0 text-danger" />
              )}
              <span className="min-w-0">
                {feedback.kind === "saved" ? (
                  <strong className="font-semibold">{t("albumMetadata.saved", { count: feedback.tracks })}</strong>
                ) : (
                  <>
                    <strong className="font-semibold">{t("metadata.saveFailed")}</strong>{" "}
                    <span className="text-muted">{t("albumMetadata.saveFailedSafe")}</span>
                  </>
                )}
              </span>
              {feedback.kind === "failed" && (
                <button
                  type="button"
                  onClick={onSave}
                  className="ml-auto shrink-0 cursor-pointer text-[0.8125rem] font-medium text-danger outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {t("albumMetadata.retry")}
                </button>
              )}
              {feedback.kind === "saved" && (
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
          disabled={isDirty || isRematching}
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
          <div className="min-w-0 flex-1">
            <div className="h-1 overflow-hidden rounded-full bg-default">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${Math.round((rematchProgress.done / Math.max(rematchProgress.total, 1)) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[0.6875rem] text-muted">{t("albumMetadata.rematch.progress", rematchProgress)}</p>
          </div>
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
