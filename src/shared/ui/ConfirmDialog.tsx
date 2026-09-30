import { AlertDialog, Button } from "@heroui/react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Yes/no confirmation. `danger`: the commit destroys something and is red.
 * `warning`: the commit is the safe path; a risky answer goes in
 * `alternative`. Corners reduced from HeroUI's 32px to `rounded-2xl`.
 */
interface ConfirmDialogProps {
  isOpen: boolean;
  /** Called for every dismissal: button, backdrop, Escape. */
  onClose: () => void;
  status: "danger" | "warning";
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** Disables the footer while the answer is processed. */
  isPending?: boolean;
  /** A quiet third option between cancel and confirm (e.g. "discard draft"). */
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
