import { toast } from "@heroui/react";
import { Undo2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ImportUndoPreview } from "@/features/import/api";
import { useImportUndoPreview, useUndoImport } from "@/features/import/hooks";
import { TOAST_EXPLAINED, TOAST_GLANCE } from "@/shared/toast/durations";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

interface ImportUndoActionProps {
  id: string;
  name: string;
}

/** Undoes one import, from the unfolded panel only. The count loads while the
 * dialog is open, from the current library rather than the archived recap. */
export function ImportUndoAction({ id, name }: ImportUndoActionProps) {
  const { t } = useTranslation("import");
  const [isOpen, setIsOpen] = useState(false);
  const preview = useImportUndoPreview(id, isOpen);
  const undo = useUndoImport();

  const confirm = () => {
    undo.mutate(id, {
      onSuccess: (outcome) => {
        setIsOpen(false);
        toast(t("undo.doneToast", { count: outcome.removed, name }), { timeout: TOAST_GLANCE });
      },
      onError: (error) => {
        setIsOpen(false);
        toast(t("undo.failedToast"), { description: String(error), timeout: TOAST_EXPLAINED });
      },
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition-colors outline-none hover:bg-danger-soft hover:text-danger focus-visible:ring-2 focus-visible:ring-danger/40"
      >
        <Undo2 className="size-3.5" />
        {t("undo.action")}
      </button>

      <ConfirmDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        status="danger"
        icon={Undo2}
        title={t("undo.title", { name })}
        cancelLabel={t("undo.keep")}
        confirmLabel={t("undo.confirm")}
        onConfirm={confirm}
        isPending={undo.isPending || preview.isPending}
      >
        <UndoBody preview={preview.data} isLoading={preview.isPending} failed={preview.isError} />
      </ConfirmDialog>
    </>
  );
}

/** How much goes, what is lost, and that the source folder is safe. */
function UndoBody({
  preview,
  isLoading,
  failed,
}: {
  preview: ImportUndoPreview | undefined;
  isLoading: boolean;
  failed: boolean;
}) {
  const { t } = useTranslation("import");

  if (failed) return <p>{t("undo.countFailed")}</p>;
  if (isLoading || !preview) return <p>{t("undo.counting")}</p>;

  // Still worth undoing: it lets the folder be imported again.
  if (preview.tracks === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p>{t("undo.nothingLeft")}</p>
        <p>{t("undo.originals")}</p>
      </div>
    );
  }

  const lines = [
    t("undo.tracks", { count: preview.tracks }),
    preview.albumsRemoved > 0 ? t("undo.albumsRemoved", { count: preview.albumsRemoved }) : null,
    preview.albumsKept > 0 ? t("undo.albumsKept", { count: preview.albumsKept }) : null,
    preview.playlistEntries > 0 ? t("undo.playlistEntries", { count: preview.playlistEntries }) : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex list-disc flex-col gap-1 pl-4 text-foreground">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p>{t("undo.edits")}</p>
      <p>{t("undo.originals")}</p>
    </div>
  );
}
