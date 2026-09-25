import { AlertDialog, Button, Input, Label, TextField } from "@heroui/react";
import { Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Confirmation for every danger-zone erase, by typing the app's name rather
 * than clicking (a click is a reflex). The phrase isn't translated, so it
 * doesn't change with the language.
 */
const PHRASE = "SONARCHE";

export function EraseDialog({
  isOpen,
  isPending,
  onClose,
  onConfirm,
  title,
  intro,
  items,
  note,
  confirmLabel,
}: {
  isOpen: boolean;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  intro: string;
  /** Listed one by one so the unexpected loss is noticed. */
  items: string[];
  /** What survives. */
  note?: string;
  confirmLabel: string;
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
              <AlertDialog.Heading className="text-lg font-semibold tracking-tight">{title}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="text-sm leading-relaxed text-muted">
              <p>{intro}</p>

              <ul className="mt-3 list-disc space-y-1 pl-5">
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              {note && <p className="mt-3">{note}</p>}

              <TextField value={typed} onChange={setTyped} className="mt-4 flex flex-col" isDisabled={isPending}>
                <Label className="text-sm font-medium text-foreground">{t("danger.prompt", { phrase: PHRASE })}</Label>
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
              <Button variant="secondary" onPress={close} isDisabled={isPending}>
                {t("danger.cancel")}
              </Button>
              <Button variant="danger" onPress={onConfirm} isDisabled={!armed || isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {confirmLabel}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
