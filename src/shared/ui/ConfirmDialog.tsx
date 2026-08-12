import { AlertDialog, Button } from "@heroui/react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The app's one binary question: an icon, a sentence, a way out and a way
 * through. Four surfaces asked it in four hand-rolled copies before this.
 *
 * `status` is the whole register. `danger` means the button that commits
 * destroys something and wears red; `warning` means the safe path is the one
 * being offered, so the commit wears the accent and the risky answer, if there
 * is one, sits in `alternative` where it reads as a way out rather than the
 * obvious next click.
 *
 * The shapes are the app's, not HeroUI's defaults: its dialog corner is 32 px,
 * which belongs to a phone alert, so the frame comes down to `rounded-2xl` —
 * still softer than the `rounded-xl` cards it floats over, no longer a
 * different design language. The buttons used to be corrected here too; the
 * theme layer now hands every button the app's own corner (see `.button` in
 * theme.css), so there is nothing left to say about them.
 */
export interface ConfirmDialogProps {
  isOpen: boolean;
  /** Called for every dismissal — the button, the backdrop, Escape. */
  onClose: () => void;
  status: "danger" | "warning";
  icon: LucideIcon;
  title: string;
  /** The body. A sentence, plus whatever the caller needs to show under it. */
  children: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** Freezes the footer while the answer is being acted on. */
  isPending?: boolean;
  /**
   * A third way out, between cancel and confirm — "discard my draft" next to
   * "keep editing" and "save". Quiet on purpose: it is an escape hatch, and a
   * third loud button would make the dialog a menu.
   */
  alternative?: { label: string; onPress: () => void; isDanger?: boolean };
}

export function ConfirmDialog({
  isOpen,
  onClose,
  status,
  icon: Icon,
  title,
  children,
  cancelLabel,
  confirmLabel,
  onConfirm,
  isPending = false,
  alternative,
}: ConfirmDialogProps) {
  return (
    <AlertDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="rounded-2xl">
            <AlertDialog.Icon status={status} className="rounded-xl">
              <Icon className="size-5" />
            </AlertDialog.Icon>
            <AlertDialog.Header>
              <AlertDialog.Heading className="text-lg font-semibold tracking-tight">{title}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="text-sm leading-relaxed text-muted">{children}</AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="secondary" onPress={onClose} isDisabled={isPending}>
                {cancelLabel}
              </Button>
              {alternative && (
                <Button
                  variant="tertiary"
                  className={alternative.isDanger ? "text-danger" : undefined}
                  onPress={alternative.onPress}
                  isDisabled={isPending}
                >
                  {alternative.label}
                </Button>
              )}
              <Button variant={status === "danger" ? "danger" : "primary"} onPress={onConfirm} isDisabled={isPending}>
                {confirmLabel}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
