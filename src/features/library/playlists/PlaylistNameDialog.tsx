import { Modal } from "@heroui/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Playlist } from "@/features/library/playlists/api";
import { playlistNameTaken } from "@/features/library/playlists/playlists";

interface PlaylistNameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  confirmLabel: string;
  /** Same duplicate rule as the backend, checked up front to explain it. */
  existing: Playlist[];
  /** See `playlistNameTaken`. */
  reservedNames?: string[];
  onSubmit: (name: string) => void;
  isPending: boolean;
}

/** Mounted per opening. */
function NameForm({
  onClose,
  title,
  confirmLabel,
  existing,
  reservedNames,
  onSubmit,
  isPending,
}: Omit<PlaylistNameDialogProps, "isOpen">) {
  const { t } = useTranslation("library");
  const [name, setName] = useState("");

  // Select once the modal's focus pass has settled.
  const grabFocus = useCallback((input: HTMLInputElement | null) => {
    if (input) setTimeout(() => input.select(), 50);
  }, []);

  const trimmed = name.trim();
  const taken = trimmed !== "" && playlistNameTaken(existing, trimmed, undefined, reservedNames);
  const canSubmit = trimmed !== "" && !taken && !isPending;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit(trimmed);
      }}
      className="flex flex-col"
    >
      <div className="px-6 pt-5 pb-1">
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      <div className="flex flex-col gap-1.5 px-6 py-4">
        <input
          ref={grabFocus}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("playlists.namePlaceholder")}
          maxLength={120}
          disabled={isPending}
          className="w-full rounded-xl border border-separator bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/30"
        />
        {/* Reserved height, so the buttons don't jump. */}
        <p className="min-h-4 text-[0.75rem] text-danger">{taken ? t("playlists.duplicateName") : ""}</p>
      </div>
      <footer className="flex items-center justify-end gap-2 px-6 pb-5">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="cursor-pointer rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {t("playlists.cancel")}
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 py-1.5 text-[0.8125rem] font-medium text-accent-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-45"
        >
          {confirmLabel}
        </button>
      </footer>
    </form>
  );
}

/** Names a new playlist; renaming is in the edit dialog. */
export function PlaylistNameDialog(props: PlaylistNameDialogProps) {
  const { isOpen, onClose, isPending } = props;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nowOpen) => {
        if (!nowOpen && !isPending) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="w-[26rem] max-w-[95vw] rounded-2xl p-0!">
            {isOpen && <NameForm {...props} />}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
