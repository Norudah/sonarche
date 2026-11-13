import { Modal } from "@heroui/react";
import type { FormEvent, ReactNode } from "react";

import { Dialog } from "@/shared/ui/Dialog";

/**
 * The frame of every short dialog (confirm, name, erase): a title, a few
 * lines, then the answers. No icon: the title asks the question and the
 * commit button's colour says what's at stake.
 */
interface SimpleDialogProps {
  isOpen: boolean;
  /** Every dismissal: Escape, a click outside, a cancel button. */
  onClose: () => void;
  title: string;
  /** Under the title, in the muted body style. */
  children: ReactNode;
  /** The buttons, right-aligned, commit last. */
  actions: ReactNode;
  /** A third answer kept apart from the others, at the footer's left. */
  startAction?: ReactNode;
  /** Locks the dialog open, e.g. while its answer is processed. */
  isDismissable?: boolean;
  /** `alertdialog` for a question that interrupts. */
  role?: "dialog" | "alertdialog";
  /** Wraps body and actions in a form, so Enter submits. */
  onSubmit?: () => void;
}

export function SimpleDialog({
  isOpen,
  onClose,
  title,
  children,
  actions,
  startAction,
  isDismissable = true,
  role = "alertdialog",
  onSubmit,
}: SimpleDialogProps) {
  const content = (
    <>
      <div className="px-6 pt-6 pb-5">
        <Modal.Heading className="text-[1.0625rem] leading-snug font-semibold tracking-tight text-balance text-foreground">
          {title}
        </Modal.Heading>
        <div className="mt-2 text-sm leading-relaxed text-pretty text-muted">{children}</div>
      </div>
      <Dialog.Footer start={startAction}>{actions}</Dialog.Footer>
    </>
  );

  return (
    <Dialog isOpen={isOpen} onClose={onClose} size="sm" isDismissable={isDismissable} role={role}>
      {onSubmit ? (
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          {content}
        </form>
      ) : (
        content
      )}
    </Dialog>
  );
}
