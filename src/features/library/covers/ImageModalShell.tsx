import { Modal, Spinner } from "@heroui/react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/**
 * The frame the cover and artist-image modals share: header with title,
 * subject line and close, a scrollable body, and a footer whose confirm is the
 * only writing step. Structured props rather than free slots on purpose — the
 * two modals should not be able to drift apart again.
 */
export function ImageModalShell({
  isOpen,
  onClose,
  title,
  subtitle,
  confirm,
  footerStart,
  error,
  children,
}: {
  isOpen: boolean;
  /** Already guarded by the caller against closing mid-write. */
  onClose: () => void;
  title: string;
  subtitle: string;
  confirm: { label: string; onConfirm: () => void; disabled: boolean; isPending: boolean };
  /** The footer's left edge — the artist modal's remove button lives here. */
  footerStart?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  const { t } = useTranslation("library");

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nowOpen) => {
        if (!nowOpen) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="max-h-[92vh] w-[46rem] max-w-[95vw] p-0!">
            <div className="flex max-h-[inherit] flex-col">
              <header className="flex shrink-0 items-start gap-3 border-b border-separator px-6 py-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">{title}</h2>
                  <p className="mt-0.5 truncate text-[0.75rem] text-muted">{subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t("metadata.close")}
                  className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-default/60 text-muted outline-none transition-colors hover:bg-default hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <X className="size-3.5" />
                </button>
              </header>

              <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
                {children}
                {error && <p className="text-center text-[0.75rem] text-danger">{error}</p>}
              </div>

              <footer className="flex shrink-0 items-center gap-2 border-t border-separator px-6 py-3.5">
                {footerStart}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {t("albumMetadata.cover.cancel")}
                </button>
                <button
                  type="button"
                  disabled={confirm.disabled}
                  onClick={confirm.onConfirm}
                  className="flex cursor-pointer items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-[0.8125rem] font-medium text-accent-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-45"
                >
                  {confirm.isPending && <Spinner size="sm" />}
                  {confirm.label}
                </button>
              </footer>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
