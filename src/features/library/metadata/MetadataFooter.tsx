import { Check, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { HERO_BUTTON_SECONDARY } from "@/features/library/heroButton";
import { useReenrichTrack } from "@/features/library/hooks";
import { RematchConfirmDialog } from "@/features/library/metadata/RematchConfirmDialog";
import { readRematchConfirm } from "@/shared/lib/rematchConfirm";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";
import { ActionHelp } from "@/shared/ui/FieldHelp";
import { springs } from "@/shared/motion/tokens";

export type SaveFeedback = { kind: "saved"; tracks: number } | { kind: "failed" } | null;

/**
 * The track panel's action bar — the album modal's, at one track's scale.
 *
 * Re-match sits on the left and is shut while anything is pending: it rewrites
 * tags from MusicBrainz, and running it over a draft used to undo the match on
 * save without a word.
 */
export function MetadataFooter({
  track,
  changed,
  feedback,
  isSaving,
  onDiscard,
  onSave,
  onDismissFeedback,
}: {
  track: LibraryTrack;
  /** How many fields the draft moves. Zero means there is nothing to save. */
  changed: number;
  feedback: SaveFeedback;
  isSaving: boolean;
  onDiscard: () => void;
  onSave: () => void;
  onDismissFeedback: () => void;
}) {
  const { t } = useTranslation("library");
  const rematch = useReenrichTrack();
  const isDirty = changed > 0;
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const startRematch = () => rematch.mutate(track.id);
  // The dialog is the default; the preference (or its own switch) silences it.
  const requestRematch = () => {
    if (readRematchConfirm()) setIsConfirmOpen(true);
    else startRematch();
  };

  // A save's own feedback owns the line; the re-match result takes it back once
  // there is nothing pending.
  const line: SaveFeedback | { kind: "matched" } | { kind: "unmatched" } = feedback
    ? feedback
    : rematch.isError
      ? { kind: "failed" }
      : rematch.isSuccess
        ? rematch.data.matched
          ? { kind: "matched" }
          : { kind: "unmatched" }
        : null;

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
            <div
              className={`flex items-center gap-2.5 px-6 py-2.5 text-[0.8125rem] ${
                line.kind === "failed" ? "bg-danger/8" : line.kind === "unmatched" ? "" : "bg-success/10"
              }`}
            >
              {line.kind === "failed" ? (
                <TriangleAlert className="size-4 shrink-0 text-danger" />
              ) : line.kind === "unmatched" ? (
                <span className="size-2 shrink-0 rounded-full bg-muted/50" />
              ) : (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
              <span className="min-w-0 text-foreground">
                {line.kind === "saved" ? (
                  <strong className="font-semibold">{t("albumMetadata.saved", { count: line.tracks })}</strong>
                ) : line.kind === "failed" ? (
                  <>
                    <strong className="font-semibold">{t("metadata.saveFailed")}</strong>{" "}
                    <span className="text-muted">{t("albumMetadata.saveFailedSafe")}</span>
                  </>
                ) : line.kind === "matched" ? (
                  t("metadata.reenrichMatched")
                ) : (
                  <span className="text-muted">{t("metadata.reenrichUnmatched")}</span>
                )}
              </span>
              {line.kind === "saved" && (
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

      <div className="flex items-center gap-2.5 px-6 py-3">
        {/* The reason rides a tooltip rather than a paragraph beside the button:
            spelled out in a 31rem drawer it wrapped onto six lines and pushed
            the actions off the bottom. */}
        <ActionHelp text={isDirty ? t("albumMetadata.rematch.blocked") : t("metadata.help.rematch")}>
          <button
            type="button"
            disabled={isDirty || rematch.isPending}
            onClick={requestRematch}
            className={`${HERO_BUTTON_SECONDARY} group/rematch shrink-0 cursor-pointer disabled:cursor-default disabled:opacity-55`}
          >
            {rematch.isPending ? (
              <Loader2 className="size-4 animate-spin text-accent" />
            ) : (
              <Sparkles className="size-4 text-accent transition-transform duration-500 ease-out group-hover/rematch:rotate-180 motion-reduce:transition-none" />
            )}
            {rematch.isPending ? t("albums.rematching") : t("albums.rematch")}
          </button>
        </ActionHelp>

        {/* Actions only, pinned right: the pending count lives in the header,
            so nothing here changes width as you type. */}
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

      <RematchConfirmDialog
        scope="track"
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          startRematch();
        }}
      />
    </footer>
  );
}
