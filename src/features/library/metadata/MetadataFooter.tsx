import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { useReenrichTrack } from "@/features/library/hooks";
import {
  DismissButton,
  FooterBanner,
  RematchButton,
  SaveActions,
  SaveFailedMessage,
  type FooterBannerLine,
  type SaveFeedback,
} from "@/features/library/metadata/EditorFooter";
import { RematchConfirmDialog } from "@/features/library/metadata/RematchConfirmDialog";
import { readRematchConfirm } from "@/shared/lib/rematchConfirm";
import { ActionHelp } from "@/shared/ui/FieldHelp";

/** The track drawer's action bar. Re-match is disabled while changes are
 * pending (saving would undo it). */
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
  /** Fields the draft moves; zero means nothing to save. */
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
  // Matching would move the track out of its collection; the sidecar refuses too.
  const isCollection = track.albumKind === "collection";
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const startRematch = () => rematch.mutate(track.id);
  const requestRematch = () => {
    if (readRematchConfirm()) setIsConfirmOpen(true);
    else startRematch();
  };

  // Save feedback wins; the re-match result returns once nothing is pending.
  const line: FooterBannerLine | null =
    feedback?.kind === "saved"
      ? {
          tone: "success",
          message: <strong className="font-semibold">{t("albumMetadata.saved", { count: feedback.tracks })}</strong>,
          action: <DismissButton onPress={onDismissFeedback} />,
        }
      : feedback?.kind === "failed"
        ? { tone: "danger", message: <SaveFailedMessage /> }
        : rematch.isError
          ? { tone: "danger", message: <SaveFailedMessage /> }
          : rematch.isSuccess
            ? rematch.data.matched
              ? { tone: "success", message: t("metadata.reenrichMatched") }
              : { tone: "neutral", message: <span className="text-muted">{t("metadata.reenrichUnmatched")}</span> }
            : null;

  return (
    <footer className="flex shrink-0 flex-col border-t border-separator bg-panel">
      <FooterBanner line={line} className="px-6" />

      <div className="flex items-center gap-2.5 px-6 py-3">
        {/* In a tooltip: a paragraph wrapped badly in the narrow drawer. */}
        <ActionHelp
          text={
            isCollection
              ? t("metadata.help.rematchCollection")
              : isDirty
                ? t("albumMetadata.rematch.blocked")
                : t("metadata.help.rematch")
          }
        >
          <RematchButton
            isRunning={rematch.isPending}
            isDisabled={isDirty || rematch.isPending || isCollection}
            onPress={requestRematch}
          />
        </ActionHelp>

        <SaveActions isDirty={isDirty} isSaving={isSaving} onDiscard={onDiscard} onSave={onSave} />
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
