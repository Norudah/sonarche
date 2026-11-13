import { Button, Input } from "@heroui/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Playlist } from "@/features/library/playlists/api";
import { playlistNameTaken } from "@/features/library/playlists/playlists";
import { SimpleDialog } from "@/shared/ui/SimpleDialog";

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

/** Names a new playlist; renaming is in the edit dialog. */
export function PlaylistNameDialog({
  isOpen,
  onClose,
  title,
  confirmLabel,
  existing,
  reservedNames,
  onSubmit,
  isPending,
}: PlaylistNameDialogProps) {
  const { t } = useTranslation("library");
  const [name, setName] = useState("");

  // A fresh field on every opening.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setName("");
  }

  // Select once the modal's focus pass has settled.
  const grabFocus = useCallback((input: HTMLInputElement | null) => {
    if (input) setTimeout(() => input.select(), 50);
  }, []);

  const trimmed = name.trim();
  const taken = trimmed !== "" && playlistNameTaken(existing, trimmed, undefined, reservedNames);
  const canSubmit = trimmed !== "" && !taken && !isPending;

  return (
    <SimpleDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      role="dialog"
      isDismissable={!isPending}
      onSubmit={() => {
        if (canSubmit) onSubmit(trimmed);
      }}
      actions={
        <>
          <Button variant="secondary" onPress={onClose} isDisabled={isPending}>
            {t("playlists.cancel")}
          </Button>
          <Button type="submit" variant="primary" isDisabled={!canSubmit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Input
        ref={grabFocus}
        aria-label={title}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("playlists.namePlaceholder")}
        maxLength={120}
        disabled={isPending}
        className="mt-2 h-10 w-full rounded-xl"
      />
      {/* Reserved height, so the buttons don't jump. */}
      <p className="mt-1.5 min-h-4 text-[0.75rem] text-danger">{taken ? t("playlists.duplicateName") : ""}</p>
    </SimpleDialog>
  );
}
