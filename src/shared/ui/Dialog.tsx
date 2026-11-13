import { cn, Modal } from "@heroui/react";
import type { ReactNode } from "react";

import { CloseButton } from "@/shared/ui/CloseButton";

const WIDTHS = {
  sm: "w-[26rem]",
  md: "w-[30rem]",
  lg: "w-[34rem]",
  xl: "w-[46rem]",
} as const;

type DialogSize = keyof typeof WIDTHS;

interface DialogProps {
  isOpen: boolean;
  /** Every dismissal: Escape, a click outside, the close button. */
  onClose: () => void;
  size?: DialogSize;
  /** Locks the dialog open, e.g. while its answer is processed. */
  isDismissable?: boolean;
  /** `alertdialog` for a question that interrupts. */
  role?: "dialog" | "alertdialog";
  /** A taller cap than 85vh, for a dialog whose body is a work surface. */
  isTall?: boolean;
  children: ReactNode;
}

/** The frame every dialog shares: blurred backdrop, 16px corners, a width
 * from the scale, and compact buttons (`.dialog-frame`, theme.css). */
function DialogRoot({
  isOpen,
  onClose,
  size = "md",
  isDismissable = true,
  role = "dialog",
  isTall = false,
  children,
}: DialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && isDismissable) onClose();
      }}
    >
      <Modal.Backdrop className="backdrop-blur-[3px]" isDismissable={isDismissable}>
        <Modal.Container>
          <Modal.Dialog
            role={role}
            className={cn(
              "dialog-frame flex max-w-[95vw] flex-col rounded-2xl p-0!",
              isTall ? "max-h-[92vh]" : "max-h-[85vh]",
              WIDTHS[size],
            )}
          >
            {children}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

interface DialogHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** With a label, a close button sits at the right. */
  close?: { label: string; onPress: () => void };
  className?: string;
}

function DialogHeader({ title, subtitle, close, className }: DialogHeaderProps) {
  return (
    <header className={cn("flex shrink-0 items-start gap-3 px-6 pt-5 pb-4", className)}>
      <div className="min-w-0 flex-1">
        <Modal.Heading className="text-[1.0625rem] leading-snug font-semibold tracking-tight text-balance text-foreground">
          {title}
        </Modal.Heading>
        {subtitle != null && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}
      </div>
      {close && <CloseButton label={close.label} onPress={close.onPress} className="-mt-0.5 -mr-1.5" />}
    </header>
  );
}

function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 pb-5", className)}>{children}</div>;
}

interface DialogFooterProps {
  /** A third answer kept apart from the others, at the left. */
  start?: ReactNode;
  /** A hairline above, for a footer under a scrolling body. */
  divided?: boolean;
  /** The answers, right-aligned, commit last. */
  children: ReactNode;
}

function DialogFooter({ start, divided = false, children }: DialogFooterProps) {
  return (
    <footer
      className={cn("flex shrink-0 items-center gap-2 px-6", divided ? "border-t border-separator py-4" : "pb-5")}
    >
      {start}
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </footer>
  );
}

/** Root, then `Header`, `Body` and `Footer`, each optional. */
export const Dialog = Object.assign(DialogRoot, {
  Header: DialogHeader,
  Body: DialogBody,
  Footer: DialogFooter,
});
