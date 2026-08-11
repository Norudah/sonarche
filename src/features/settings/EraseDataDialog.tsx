import { AlertDialog, Button, Input, Label, TextField } from "@heroui/react";
import { Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * The last thing between someone and their whole library.
 *
 * Not a `ConfirmDialog`: this one is deliberately not a binary question. A
 * two-button dialog is a reflex — the muscle memory that dismisses a hundred
 * harmless ones lands on the same pixel here — and the only reliable way to
 * break that reflex is to ask for something a reflex cannot produce. Typing the
 * word forces a reading of the sentence above it.
 *
 * The phrase is the app's own name and it is not translated. A confirmation
 * token that changes with the interface language is a token that can be
 * mistyped by someone who switched language yesterday.
 */
const PHRASE = "SONARCHE";

export function EraseDataDialog({
  isOpen,
  isErasing,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  isErasing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("settings");
  const [typed, setTyped] = useState("");

  const armed = typed.trim() === PHRASE;
  const close = () => {
    setTyped("");
    onClose();
  };

  return (
    <AlertDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="rounded-2xl">
            <AlertDialog.Icon status="danger" className="rounded-xl">
              <ShieldAlert className="size-5" />
            </AlertDialog.Icon>
            <AlertDialog.Header>
              <AlertDialog.Heading className="text-lg font-semibold tracking-tight">
                {t("library.danger.erase.dialogTitle")}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="text-sm leading-relaxed text-muted">
              <p>{t("library.danger.erase.dialogBody")}</p>

              {/* Named one by one rather than as "all your data": the point of
                  this list is that someone reads it and finds the item they
                  did not expect to lose. */}
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li>{t("library.danger.erase.itemFiles")}</li>
                <li>{t("library.danger.erase.itemIndex")}</li>
                <li>{t("library.danger.erase.itemPlaylists")}</li>
                <li>{t("library.danger.erase.itemHistory")}</li>
                <li>{t("library.danger.erase.itemKeys")}</li>
              </ul>

              <p className="mt-3">{t("library.danger.erase.keepsEngine")}</p>

              <TextField value={typed} onChange={setTyped} className="mt-4 flex flex-col" isDisabled={isErasing}>
                <Label className="text-sm font-medium text-foreground">
                  {t("library.danger.erase.prompt", { phrase: PHRASE })}
                </Label>
                <Input
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={PHRASE}
                  className="mt-1.5 h-10 w-full rounded-xl font-mono"
                />
              </TextField>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="secondary" onPress={close} isDisabled={isErasing}>
                {t("library.danger.erase.cancel")}
              </Button>
              <Button variant="danger" onPress={onConfirm} isDisabled={!armed || isErasing}>
                {isErasing && <Loader2 className="size-4 animate-spin" />}
                {t("library.danger.erase.confirm")}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
