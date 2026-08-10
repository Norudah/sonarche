import { toast } from "@heroui/react";
import { Undo2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ImportUndoPreview } from "@/features/import/api";
import { useImportUndoPreview, useUndoImport } from "@/features/import/hooks";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

interface ImportUndoActionProps {
  id: string;
  /** The folder's own name, so the question names the thing being undone
   * rather than "this import". */
  name: string;
}

/**
 * Taking one import back out.
 *
 * Inside the unfolded panel and nowhere else: on the closed row this would sit
 * one click from a feed of them, and it deletes music. Quiet on purpose — it is
 * a way out, not the thing the archive is for.
 *
 * The count is fetched while the dialog is already open. It comes from a walk
 * of the library, so waiting for it before showing anything would read as a
 * click that did nothing, and it cannot be taken from the archive's own recap:
 * that says what the run brought in months ago, not what is still there.
 */
export function ImportUndoAction({ id, name }: ImportUndoActionProps) {
  const { t } = useTranslation("import");
  const [isOpen, setIsOpen] = useState(false);
  const preview = useImportUndoPreview(id, isOpen);
  const undo = useUndoImport();

  const confirm = () => {
    undo.mutate(id, {
      onSuccess: (outcome) => {
        setIsOpen(false);
        toast(t("undo.doneToast", { count: outcome.removed, name }));
      },
      onError: (error) => {
        setIsOpen(false);
        toast(t("undo.failedToast"), { description: String(error) });
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

/** What is about to go, then what is not coming back, then the one thing that
 * is never at risk. In that order: the count answers "how much", the warning
 * answers "what do I lose", and the reassurance is what makes the decision
 * takeable at all. */
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

  // A run whose tracks are all gone already: nothing to delete, and undoing is
  // still worth offering — it is what lets the folder be imported again.
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
