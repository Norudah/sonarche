import { useTranslation } from "react-i18next";

import type { ChangeSummary } from "@/features/library/albums/albumFields";
import { HERO_BUTTON_SECONDARY } from "@/features/library/heroButton";
import {
  DismissButton,
  FooterBanner,
  RematchButton,
  SaveActions,
  SaveFailedMessage,
  type FooterBannerLine,
  type SaveFeedback,
} from "@/features/library/metadata/EditorFooter";
import { FieldHelp } from "@/shared/ui/FieldHelp";

/** The last re-match's counts, or its error. */
type RematchOutcome =
  { kind: "failed" } | { kind: "finished"; matched: number; done: number; total: number; cancelled: boolean } | null;

/** Action bar. Re-match is disabled while changes are pending (saving would
 * undo it) and can be stopped after the track in flight. */
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
  /** No release to match against: re-match is off, with the reason shown. */
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

  // Save feedback wins; the re-match verdict returns once nothing is pending.
  const line: FooterBannerLine | null =
    feedback?.kind === "saved"
      ? {
          tone: "success",
          message: <strong className="font-semibold">{t("albumMetadata.saved", { count: feedback.tracks })}</strong>,
          action: <DismissButton onPress={onDismissFeedback} />,
        }
      : feedback?.kind === "failed"
        ? {
            tone: "danger",
            message: <SaveFailedMessage />,
            action: (
              <button
                type="button"
                onClick={onSave}
                className="ml-auto shrink-0 cursor-pointer text-[0.8125rem] font-medium text-danger outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {t("albumMetadata.retry")}
              </button>
            ),
          }
        : rematchOutcome?.kind === "failed"
          ? { tone: "danger", message: t("albumMetadata.rematch.failed") }
          : rematchOutcome?.kind === "finished"
            ? rematchOutcome.cancelled
              ? {
                  tone: "neutral",
                  message: <span className="text-muted">{t("albumMetadata.rematch.stopped", rematchOutcome)}</span>,
                }
              : { tone: "success", message: t("albums.rematchDone", rematchOutcome) }
            : null;

  return (
    <footer className="flex shrink-0 flex-col border-t border-separator bg-panel">
      <FooterBanner line={line} className="px-5" />

      <div className="flex items-center gap-3 px-5 py-3">
        <RematchButton
          isRunning={isRematching}
          isDisabled={isDirty || isRematching || isCollection}
          onPress={onRematch}
        />

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

        <SaveActions isDirty={isDirty} isSaving={isSaving} onDiscard={onDiscard} onSave={onSave} />
      </div>
    </footer>
  );
}
