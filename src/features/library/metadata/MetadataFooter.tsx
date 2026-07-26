import { Loader2, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { HERO_PILL_SECONDARY } from "@/features/library/heroPill";
import { useReenrichTrack } from "@/features/library/hooks";
import { PrimaryPill } from "@/features/library/metadata/PrimaryPill";
import { springs } from "@/shared/motion/tokens";

/** Re-runs the acoustic match over this one track — the album hero's pill, scoped
 * to a single row, same word and half-turn sparkle. Sits where a delete used to;
 * deletion already lives in the row's overflow menu, so the panel doesn't repeat
 * it. Its result is stated on the line above rather than as a toast. */
function RematchButton({ track }: { track: LibraryTrack }) {
  const { t } = useTranslation("library");
  const reenrich = useReenrichTrack();

  return (
    <button
      type="button"
      disabled={reenrich.isPending}
      onClick={() => reenrich.mutate(track.id)}
      className={`${HERO_PILL_SECONDARY} group/rematch cursor-pointer disabled:cursor-default disabled:opacity-60`}
    >
      {reenrich.isPending ? (
        <Loader2 className="size-4 animate-spin text-accent" />
      ) : (
        <Sparkles className="size-4 text-accent transition-transform duration-500 ease-out group-hover/rematch:rotate-180 motion-reduce:transition-none" />
      )}
      {reenrich.isPending ? t("albums.rematching") : t("albums.rematch")}
    </button>
  );
}

interface MetadataFooterProps {
  track: LibraryTrack;
  isEditing: boolean;
  isSaving: boolean;
  saveFailed: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}

/**
 * The panel's action bar. Re-match sits on the left in both modes; the right is
 * the mode's own control — Modifier while reading, Annuler + Enregistrer while
 * editing. The re-match result rides the line above, answering the question its
 * button just asked.
 */
export function MetadataFooter({
  track,
  isEditing,
  isSaving,
  saveFailed,
  onEdit,
  onCancel,
  onSave,
}: MetadataFooterProps) {
  const { t } = useTranslation("library");
  const reenrich = useReenrichTrack();

  // A save error owns the feedback line while editing; re-match feedback takes
  // it back in read mode.
  const feedback = saveFailed
    ? { text: t("metadata.saveFailed"), tone: "text-danger" }
    : reenrich.isError
      ? { text: t("metadata.reenrichFailed"), tone: "text-danger" }
      : reenrich.isSuccess
        ? reenrich.data.matched
          ? { text: t("metadata.reenrichMatched"), tone: "text-success" }
          : { text: t("metadata.reenrichUnmatched"), tone: "text-muted" }
        : null;

  return (
    <footer className="flex flex-col gap-2.5 border-t border-separator px-7 py-3.5">
      {feedback && <p className={`text-[0.8125rem] ${feedback.tone}`}>{feedback.text}</p>}

      <div className="flex items-center justify-between gap-3">
        <RematchButton track={track} />

        <div className="flex items-center gap-2.5">
          {isEditing ? (
            <>
              {/* Newly arrived with edit mode, so it pops in rather than blinking on. */}
              <motion.button
                type="button"
                onClick={onCancel}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={springs.bouncy}
                className={`${HERO_PILL_SECONDARY} cursor-pointer`}
              >
                {t("metadata.cancel")}
              </motion.button>
              <PrimaryPill onPress={onSave} isPending={isSaving}>
                {isSaving ? t("metadata.saving") : t("metadata.save")}
              </PrimaryPill>
            </>
          ) : (
            <PrimaryPill onPress={onEdit}>{t("metadata.edit")}</PrimaryPill>
          )}
        </div>
      </div>
    </footer>
  );
}
