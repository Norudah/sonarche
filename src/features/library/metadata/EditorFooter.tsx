import { Check, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { HERO_BUTTON_SECONDARY } from "@/features/library/heroButton";
import { springs } from "@/shared/motion/tokens";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";

/** Pieces shared by the track drawer's and the album inspector's action bars. */

export type SaveFeedback = { kind: "saved"; tracks: number } | { kind: "failed" } | null;

/** `neutral` is an outcome that is neither a success nor a failure (nothing matched, stopped). */
type BannerTone = "success" | "danger" | "neutral";

export interface FooterBannerLine {
  tone: BannerTone;
  message: ReactNode;
  /** Trailing control: retry, dismiss. */
  action?: ReactNode;
}

const WASH: Record<BannerTone, string> = { success: "bg-success/10", danger: "bg-danger/8", neutral: "" };

/** The result line above the action bar; slides in and out. */
export function FooterBanner({ line, className = "" }: { line: FooterBannerLine | null; className?: string }) {
  return (
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
            className={`flex items-center gap-2.5 py-2.5 text-[0.8125rem] text-foreground ${WASH[line.tone]} ${className}`}
          >
            {line.tone === "danger" ? (
              <TriangleAlert className="size-4 shrink-0 text-danger" />
            ) : line.tone === "neutral" ? (
              <span className="size-2 shrink-0 rounded-full bg-muted/50" />
            ) : (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                <Check className="size-3" strokeWidth={3} />
              </span>
            )}
            <span className="min-w-0">{line.message}</span>
            {line.action}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The "saved" line's close button. */
export function DismissButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation("library");
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={t("metadata.close")}
      className="ml-auto shrink-0 cursor-pointer rounded-full p-1 text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <Check className="size-3.5" />
    </button>
  );
}

/** The save-failure message; the write is all-or-nothing, so the files are intact. */
export function SaveFailedMessage() {
  const { t } = useTranslation("library");
  return (
    <>
      <strong className="font-semibold">{t("metadata.saveFailed")}</strong>{" "}
      <span className="text-muted">{t("albumMetadata.saveFailedSafe")}</span>
    </>
  );
}

export function RematchButton({
  isRunning,
  isDisabled,
  onPress,
}: {
  isRunning: boolean;
  isDisabled: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation("library");
  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onPress}
      className={`${HERO_BUTTON_SECONDARY} group/rematch shrink-0 cursor-pointer disabled:cursor-default disabled:opacity-55`}
    >
      {isRunning ? (
        <Loader2 className="size-4 animate-spin text-accent" />
      ) : (
        <Sparkles className="size-4 text-accent transition-transform duration-500 ease-out group-hover/rematch:rotate-180 motion-reduce:transition-none" />
      )}
      {isRunning ? t("albums.rematching") : t("albums.rematch")}
    </button>
  );
}

/** Cancel (only while dirty) and Save. The pending count lives in the header,
 * so these buttons don't shift. */
export function SaveActions({
  isDirty,
  isSaving,
  onDiscard,
  onSave,
}: {
  isDirty: boolean;
  isSaving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation("library");
  return (
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
  );
}
