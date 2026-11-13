import { Button, Spinner } from "@heroui/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Dialog } from "@/shared/ui/Dialog";

/** The frame shared by the cover and artist-image modals. Structured props so
 * the two can't drift apart. */
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
  /** The caller already guards against closing mid-write. */
  onClose: () => void;
  title: string;
  subtitle: string;
  confirm: { label: string; onConfirm: () => void; disabled: boolean; isPending: boolean };
  /** Footer's left edge (the artist modal's remove button). */
  footerStart?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  const { t } = useTranslation("library");

  return (
    <Dialog isOpen={isOpen} onClose={onClose} size="xl" isTall>
      <Dialog.Header title={title} subtitle={subtitle} close={{ label: t("metadata.close"), onPress: onClose }} />

      <Dialog.Body className="flex flex-col gap-5">
        {children}
        {error && <p className="text-center text-[0.75rem] text-danger">{error}</p>}
      </Dialog.Body>

      <Dialog.Footer divided start={footerStart}>
        <Button variant="secondary" onPress={onClose}>
          {t("albumMetadata.cover.cancel")}
        </Button>
        <Button variant="primary" isDisabled={confirm.disabled} onPress={confirm.onConfirm}>
          {confirm.isPending && <Spinner size="sm" />}
          {confirm.label}
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
