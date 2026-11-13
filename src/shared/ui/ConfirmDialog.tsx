import { Button } from "@heroui/react";
import type { ReactNode } from "react";

import { SimpleDialog } from "@/shared/ui/SimpleDialog";

/**
 * Yes/no confirmation. `danger`: the commit destroys something and is red.
 * `warning`: the commit is the safe path; a risky answer goes in
 * `alternative`, set apart on the left.
 */
interface ConfirmDialogProps {
  isOpen: boolean;
  /** Called for every dismissal: button, backdrop, Escape. */
  onClose: () => void;
  status: "danger" | "warning";
  title: string;
  children: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** Disables the footer while the answer is processed. */
  isPending?: boolean;
  /** A third answer (e.g. "discard draft"). */
  alternative?: { label: string; onPress: () => void; isDanger?: boolean };
}

export function ConfirmDialog({
  isOpen,
  onClose,
  status,
  title,
  children,
  cancelLabel,
  confirmLabel,
  onConfirm,
  isPending = false,
  alternative,
}: ConfirmDialogProps) {
  return (
    <SimpleDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      isDismissable={!isPending}
      startAction={
        alternative && (
          <Button
            variant="ghost"
            className={alternative.isDanger ? "-ml-2 text-danger" : "-ml-2"}
            onPress={alternative.onPress}
            isDisabled={isPending}
          >
            {alternative.label}
          </Button>
        )
      }
      actions={
        <>
          <Button variant="secondary" onPress={onClose} isDisabled={isPending}>
            {cancelLabel}
          </Button>
          <Button variant={status === "danger" ? "danger" : "primary"} onPress={onConfirm} isDisabled={isPending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </SimpleDialog>
  );
}
