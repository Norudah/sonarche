import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

/** Guards a pending draft on close: save (primary), discard, or keep editing. */
export function ExitGuardDialog({
  pendingFields,
  isSaving,
  onKeepEditing,
  onDiscard,
  onSave,
}: {
  /** Zero closes the dialog. */
  pendingFields: number;
  isSaving: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation("library");

  // Keeps the count during the closing animation.
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
