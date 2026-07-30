import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

/**
 * The confirmation that stands between a pending draft and the ✕.
 *
 * Closing used to throw the draft away without a word — backdrop, ✕ and Escape
 * all did it, and five minutes of typing were easier to lose than to keep.
 * Three ways out, because the honest answer to "you are about to lose this" is
 * usually "then save it", not just yes or no — so saving is what the loud
 * button does, and discarding sits in the quiet slot beside it.
 */
export function ExitGuardDialog({
  pendingFields,
  isSaving,
  onKeepEditing,
  onDiscard,
  onSave,
}: {
  /** Zero closes the dialog — the guard only exists while something is at stake. */
  pendingFields: number;
  isSaving: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation("library");

  // Hold the last count so the sentence doesn't read "0 changes" while the
  // dialog animates out.
  const [lastCount, setLastCount] = useState(pendingFields);
  if (pendingFields > 0 && pendingFields !== lastCount) setLastCount(pendingFields);

  return (
    <ConfirmDialog
      isOpen={pendingFields > 0}
      onClose={onKeepEditing}
      status="warning"
      icon={TriangleAlert}
      title={t("albumMetadata.guard.title")}
      cancelLabel={t("albumMetadata.guard.keepEditing")}
      alternative={{ label: t("albumMetadata.guard.discard"), onPress: onDiscard, isDanger: true }}
      confirmLabel={t("metadata.save")}
      onConfirm={onSave}
      isPending={isSaving}
    >
      <p>{t("albumMetadata.guard.body", { count: lastCount })}</p>
    </ConfirmDialog>
  );
}
