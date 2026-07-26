import { AlertDialog, Button } from "@heroui/react";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * The confirmation that stands between a pending draft and the ✕.
 *
 * Closing used to throw the draft away without a word — backdrop, ✕ and Escape
 * all did it, and five minutes of typing were easier to lose than to keep.
 * Three ways out, because the honest answer to "you are about to lose this" is
 * usually "then save it", not just yes or no.
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
    <AlertDialog
      isOpen={pendingFields > 0}
      onOpenChange={(open) => {
        if (!open) onKeepEditing();
      }}
    >
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Icon status="warning">
              <TriangleAlert className="size-5" />
            </AlertDialog.Icon>
            <AlertDialog.Header>
              <AlertDialog.Heading>{t("albumMetadata.guard.title")}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>{t("albumMetadata.guard.body", { count: lastCount })}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="secondary" onPress={onKeepEditing} isDisabled={isSaving}>
                {t("albumMetadata.guard.keepEditing")}
              </Button>
              <Button variant="tertiary" className="text-danger" onPress={onDiscard} isDisabled={isSaving}>
                {t("albumMetadata.guard.discard")}
              </Button>
              <Button variant="primary" onPress={onSave} isDisabled={isSaving}>
                {t("metadata.save")}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
