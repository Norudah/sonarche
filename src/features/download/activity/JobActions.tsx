import { Button, Modal, toast } from "@heroui/react";
import { FolderInput, RotateCcw, Undo2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import type { DownloadJob, DownloadUndoPreview, ForcedAlbum } from "@/features/download/api";
import {
  AUTO_DESTINATION,
  type Destination,
  DestinationChoice,
  toForcedAlbum,
} from "@/features/download/DestinationChoice";
import {
  useChangeJobDestination,
  useDownloadUndoPreview,
  useEnqueueDownload,
  useUndoDownload,
} from "@/features/download/hooks";
import { TOAST_EXPLAINED, TOAST_GLANCE } from "@/shared/toast/durations";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

/** Shared panel button; `danger` for the one that deletes music. */
function PanelAction({
  icon: Icon,
  label,
  danger,
  onPress,
}: {
  icon: typeof Undo2;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={
        "flex w-fit cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition-colors outline-none " +
        (danger
          ? "hover:bg-danger-soft hover:text-danger focus-visible:ring-2 focus-visible:ring-danger/40"
          : "hover:bg-default/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40")
      }
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

/** A job's queued filing as the destination control's state. */
function destinationOf(forced: ForcedAlbum | null): Destination {
  if (!forced) return AUTO_DESTINATION;
  if (forced.albumId != null) {
    return { mode: "existing", target: { albumId: forced.albumId, title: forced.title, artist: forced.artist ?? "" } };
  }
  return { mode: "new", title: forced.title, artist: forced.artist };
}

function DestinationDialog({
  isOpen,
  onClose,
  title,
  hint,
  confirmLabel,
  job,
  modes,
  initial,
  isPending,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  hint: ReactNode;
  confirmLabel: string;
  job: DownloadJob;
  modes: Destination["mode"][];
  initial: Destination;
  isPending: boolean;
  onConfirm: (forced: ForcedAlbum | null) => void;
}) {
  const { t } = useTranslation("download");
  const [destination, setDestination] = useState<Destination>(initial);
  const forced = toForcedAlbum(destination);
  // `auto` is valid for a re-download, never for a move.
  const committable = destination.mode === "auto" ? modes.includes("auto") : forced != null;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nowOpen) => {
        if (!nowOpen) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="max-h-[85vh] w-[34rem] max-w-[95vw] overflow-y-auto rounded-2xl">
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              <div className="text-[0.8125rem] leading-relaxed text-muted">{hint}</div>
              <DestinationChoice value={destination} kind={job.kind} onChange={setDestination} modes={modes} />
              <div className="mt-1 flex justify-end gap-2">
                <Button variant="secondary" onPress={onClose} isDisabled={isPending}>
                  {t("actions.cancel")}
                </Button>
                <Button variant="primary" onPress={() => onConfirm(forced)} isDisabled={!committable || isPending}>
                  {confirmLabel}
                </Button>
              </div>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/** What will be removed, then a warning: the downloaded file is gone for good. */
function UndoBody({
  preview,
  isLoading,
  failed,
}: {
  preview: DownloadUndoPreview | undefined;
  isLoading: boolean;
  failed: boolean;
}) {
  const { t } = useTranslation("download");

  if (failed) return <p>{t("actions.undo.countFailed")}</p>;
  if (isLoading || !preview) return <p>{t("actions.undo.counting")}</p>;
  if (preview.tracks === 0) return <p>{t("actions.undo.nothingLeft")}</p>;

  const lines = [
    t("actions.undo.tracks", { count: preview.tracks }),
    preview.albumsRemoved > 0 ? t("actions.undo.albumsRemoved", { count: preview.albumsRemoved }) : null,
    preview.albumsKept > 0 ? t("actions.undo.albumsKept", { count: preview.albumsKept }) : null,
    preview.playlistEntries > 0 ? t("actions.undo.playlistEntries", { count: preview.playlistEntries }) : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex list-disc flex-col gap-1 pl-4 text-foreground">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p>{t("actions.undo.noOriginals")}</p>
    </div>
  );
}

/** Actions on a settled job, in its unfolded panel: re-download, change the
 * destination (no network), and undo. */
export function JobActions({ job, canUndo }: { job: DownloadJob; canUndo: boolean }) {
  const { t } = useTranslation("download");
  const [open, setOpen] = useState<"undo" | "move" | "redownload" | null>(null);
  const preview = useDownloadUndoPreview(job.id, open === "undo");
  const undo = useUndoDownload();
  const move = useChangeJobDestination();
  const enqueue = useEnqueueDownload();

  const name = job.title ?? job.url;

  const confirmUndo = () => {
    undo.mutate(job.id, {
      onSuccess: (outcome) => {
        setOpen(null);
        toast(t("actions.undo.doneToast", { count: outcome.removed, name }), { timeout: TOAST_GLANCE });
      },
      onError: (error) => {
        setOpen(null);
        toast(t("actions.undo.failedToast"), { description: String(error), timeout: TOAST_EXPLAINED });
      },
    });
  };

  const confirmMove = (forced: ForcedAlbum | null) => {
    if (!forced) return;
    move.mutate(
      { id: job.id, forcedAlbum: forced },
      {
        onSuccess: () => {
          setOpen(null);
          toast(t("actions.move.doneToast", { album: forced.title }), { timeout: TOAST_GLANCE });
        },
        onError: (error) => {
          setOpen(null);
          toast(t("actions.move.failedToast"), { description: String(error), timeout: TOAST_EXPLAINED });
        },
      },
    );
  };

  const confirmRedownload = (forced: ForcedAlbum | null) => {
    enqueue.mutate(
      { url: job.url, kind: job.kind, category: job.category, forcedAlbum: forced, singleAlbum: job.singleAlbum },
      {
        onSuccess: () => {
          setOpen(null);
          toast(t("actions.redownload.doneToast", { name }), { timeout: TOAST_GLANCE });
        },
        onError: (error) => {
          setOpen(null);
          toast(t("actions.redownload.failedToast"), { description: String(error), timeout: TOAST_EXPLAINED });
        },
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <PanelAction icon={RotateCcw} label={t("actions.redownload.action")} onPress={() => setOpen("redownload")} />
      {canUndo && (
        <>
          <PanelAction icon={FolderInput} label={t("actions.move.action")} onPress={() => setOpen("move")} />
          <PanelAction icon={Undo2} label={t("actions.undo.action")} danger onPress={() => setOpen("undo")} />
        </>
      )}

      <ConfirmDialog
        isOpen={open === "undo"}
        onClose={() => setOpen(null)}
        status="danger"
        icon={Undo2}
        title={t("actions.undo.title", { name })}
        cancelLabel={t("actions.undo.keep")}
        confirmLabel={t("actions.undo.confirm")}
        onConfirm={confirmUndo}
        isPending={undo.isPending || preview.isPending}
      >
        <UndoBody preview={preview.data} isLoading={preview.isPending} failed={preview.isError} />
      </ConfirmDialog>

      {/* Keyed so each opening starts from the job's current filing. */}
      {open === "move" && (
        <DestinationDialog
          isOpen
          onClose={() => setOpen(null)}
          title={t("actions.move.title")}
          hint={<p>{t("actions.move.hint")}</p>}
          confirmLabel={t("actions.move.confirm")}
          job={job}
          modes={["existing", "new"]}
          initial={{ mode: "existing", target: null }}
          isPending={move.isPending}
          onConfirm={confirmMove}
        />
      )}

      {open === "redownload" && (
        <DestinationDialog
          isOpen
          onClose={() => setOpen(null)}
          title={t("actions.redownload.title")}
          hint={<p>{t("actions.redownload.hint")}</p>}
          confirmLabel={t("actions.redownload.confirm")}
          job={job}
          modes={["auto", "existing", "new"]}
          initial={destinationOf(job.forcedAlbum)}
          isPending={enqueue.isPending}
          onConfirm={confirmRedownload}
        />
      )}
    </div>
  );
}
