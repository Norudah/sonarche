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
  /** Every playlist, for the duplicate check — the same rule the backend
   * enforces, applied before the round-trip so the dialog can say why. */
  existing: Playlist[];
  /** Names taken by something that is not a stored row name — the favorites'
   * localized label. See `playlistNameTaken`. */
  reservedNames?: string[];
  onSubmit: (name: string) => void;
  isPending: boolean;
}

/** The form proper, mounted per opening: its state starts fresh each time the
 * dialog appears, with no effect to re-arm it. */
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

  // Select-on-mount, once the modal's own focus pass has settled. A callback
  // ref rather than an effect: the field exists exactly once per opening.
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
        {/* Reserved line: the dialog must not grow when the error appears, or
            the buttons jump under the pointer. */}
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

/**
 * The one question asked when a playlist is born: what is it called. Renaming
 * an existing one is not here — it is one field of the edit dialog, beside the
 * tile and the sidebar glyph, so a playlist has exactly one place to be
 * changed.
 */
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
