import { Modal, Spinner } from "@heroui/react";
import { ImagePlus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import type { Playlist } from "@/features/library/playlists/api";
import { useRenamePlaylist, useSetPlaylistMarker } from "@/features/library/playlists/hooks";
import { resolveMarker } from "@/features/library/playlists/marker";
import {
  EditDialogHeader,
  EDIT_DIALOG_BODY,
  EDIT_DIALOG_CONFIRM_BUTTON,
  EDIT_DIALOG_FOOTER,
  EDIT_DIALOG_QUIET_BUTTON,
} from "@/features/library/playlists/PlaylistEditChrome";
import { PlaylistCoverMosaic } from "@/features/library/playlists/PlaylistCoverMosaic";
import { PlaylistGlyph } from "@/features/library/playlists/PlaylistGlyph";
import { PlaylistImageStep } from "@/features/library/playlists/PlaylistImageStep";
import { PlaylistMarkerPicker } from "@/features/library/playlists/PlaylistMarkerPicker";
import { playlistCovers, playlistNameTaken } from "@/features/library/playlists/playlists";

/** 448 (form) + 12 + 544 = 1004, inside the 1032 a 1080px window leaves once the
 * container's fence is paid. Widen one and the pair stops fitting. */
const IMAGE_PANE_PX = 544;

interface PlaylistEditDialogProps {
  playlist: Playlist;
  /** Members resolved against the library, for the tile's mosaic. */
  tracks: LibraryTrack[];
  /** Every playlist, for the duplicate-name check. */
  existing: Playlist[];
  /** Names taken by something that is not a stored row name — see
   * `playlistNameTaken`. */
  reservedNames: string[];
  isOpen: boolean;
  onClose: () => void;
}

/** The form proper, mounted per opening: its draft starts from the playlist as
 * it stands, with no effect to re-arm it. */
function EditForm({
  playlist,
  tracks,
  existing,
  reservedNames,
  onClose,
  onEditImage,
  isPickingImage,
}: Omit<PlaylistEditDialogProps, "isOpen"> & { onEditImage: () => void; isPickingImage: boolean }) {
  const { t } = useTranslation("library");
  const rename = useRenamePlaylist();
  const setMarker = useSetPlaylistMarker();

  const [name, setName] = useState(playlist.name);
  const [marker, setMarkerDraft] = useState<string | null>(playlist.marker);
  const [failed, setFailed] = useState(false);

  const grabFocus = useCallback((input: HTMLInputElement | null) => {
    if (input) setTimeout(() => input.select(), 50);
  }, []);

  const trimmed = name.trim();
  const taken = trimmed !== "" && playlistNameTaken(existing, trimmed, playlist.id, reservedNames);
  const dirty = trimmed !== playlist.name || marker !== playlist.marker;
  const isPending = rename.isPending || setMarker.isPending;
  const canSave = trimmed !== "" && !taken && dirty && !isPending;

  /** The two writes behind one button. Sequential rather than parallel: if the
   * rename is refused, the marker must not have moved either — a half-applied
   * "Enregistrer" is the one outcome nobody can reason about. */
  const persist = async () => {
    setFailed(false);
    try {
      if (trimmed !== playlist.name) await rename.mutateAsync({ id: playlist.id, name: trimmed });
      if (marker !== playlist.marker) await setMarker.mutateAsync({ id: playlist.id, marker: marker ?? "" });
      return true;
    } catch {
      setFailed(true);
      return false;
    }
  };

  const save = async () => {
    if (await persist()) onClose();
  };

  // The list as the app will draw it once saved — its tile on the shelves, its
  // row in the sidebar. Both read from the draft, so every control below is
  // visibly a way of changing this one strip.
  const preview = (
    <div className="flex items-center gap-4 rounded-xl bg-background p-3 ring-1 ring-separator">
      <button
        type="button"
        onClick={onEditImage}
        aria-label={t("playlists.edit.changeImage")}
        aria-expanded={isPickingImage}
        className={`group relative size-16 shrink-0 cursor-pointer overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${isPickingImage ? "ring-2 ring-accent ring-offset-2 ring-offset-overlay" : ""}`}
      >
        <PlaylistCoverMosaic
          covers={playlistCovers(tracks)}
          customUrl={playlist.coverUrl}
          className="size-full ring-1 ring-artwork-edge"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ImagePlus className="size-4 text-white" />
        </span>
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-3 rounded-lg bg-accent/15 px-3 py-1.5 text-sm font-medium text-accent">
          <PlaylistGlyph marker={resolveMarker({ ...playlist, marker })} className="size-4" />
          <span className="min-w-0 truncate">{trimmed || t("playlists.namePlaceholder")}</span>
        </div>
        <button
          type="button"
          onClick={onEditImage}
          className="cursor-pointer self-start rounded text-[0.75rem] text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {t("playlists.edit.changeImage")}
        </button>
      </div>
    </div>
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) void save();
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <EditDialogHeader title={t("playlists.edit.title")} subtitle={playlist.name} onClose={onClose} />

      <div className={EDIT_DIALOG_BODY}>
        {preview}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="playlist-name" className="text-[10px] font-semibold tracking-widest text-muted/70 uppercase">
            {t("playlists.edit.name")}
          </label>
          <input
            id="playlist-name"
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
              everything below jumps under the pointer. */}
          <p className="min-h-4 text-[0.75rem] text-danger">{taken ? t("playlists.duplicateName") : ""}</p>
        </div>

        <section className="flex flex-col gap-3 border-t border-separator pt-4">
          <div>
            <h3 className="text-[0.8125rem] font-semibold text-foreground">{t("playlists.marker.title")}</h3>
            <p className="mt-0.5 text-[0.75rem] text-muted">{t("playlists.marker.subtitle")}</p>
          </div>
          <PlaylistMarkerPicker
            value={marker}
            onPick={(value) => setMarkerDraft(value || null)}
            coverUrl={playlist.coverUrl}
            onAddImage={onEditImage}
          />
        </section>
      </div>

      <footer className={EDIT_DIALOG_FOOTER}>
        {failed && <p className="text-[0.75rem] text-danger">{t("playlists.edit.failed")}</p>}
        <div className="flex-1" />
        <button type="button" onClick={onClose} disabled={isPending} className={EDIT_DIALOG_QUIET_BUTTON}>
          {t("playlists.cancel")}
        </button>
        <button type="submit" disabled={!canSave} className={EDIT_DIALOG_CONFIRM_BUTTON}>
          {isPending && <Spinner size="sm" />}
          {t("playlists.edit.save")}
        </button>
      </footer>
    </form>
  );
}

/**
 * Everything a playlist is, in one place: its name, the tile it wears on the
 * shelves, and the glyph it wears in the sidebar.
 *
 * They used to be three doors — a rename dialog, an image modal, a marker
 * picker, two of them buried in an overflow menu. Three ways to change one
 * object is three things to find, and none of them said "this is where you
 * edit a playlist". One "Modifier" button now opens all of it, which is the
 * same promise the album and the artist make.
 *
 * Picking an image is the one thing that keeps a panel of its own. It needs a
 * room — browse, drop, paste, reframe, two stages — that a form has no business
 * hosting. That panel unfolds *beside* the form rather than over it or in place
 * of it: a window that leaves and comes back, and a single frame that resizes
 * under the eye, both read as two errands. Side by side, the form never
 * changes shape, stays live (the draft survives the trip, and a fresh image is
 * immediately offerable as the sidebar glyph), and its tile keeps showing what
 * the pane next door is about to replace.
 */
export function PlaylistEditDialog({ isOpen, ...rest }: PlaylistEditDialogProps) {
  const [pickingImage, setPickingImage] = useState(false);

  // Every way out passes here, so the next opening can never come back with the
  // image pane already unfolded.
  const close = () => {
    setPickingImage(false);
    rest.onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nowOpen) => {
        if (!nowOpen) close();
      }}
    >
      <Modal.Backdrop>
        {/* The dialog grows sideways, so the padding that fences it has to be
            thin enough for both panes at the app's 1080px floor. */}
        <Modal.Container className="sm:px-6!">
          <Modal.Dialog className="w-auto! max-w-full overflow-visible! bg-transparent! p-0! shadow-none!">
            <div
              className="flex items-start"
              // Escape belongs to the topmost thing that is open. With one modal
              // holding both panes, that arbitration is ours to make.
              onKeyDown={(event) => {
                if (event.key === "Escape" && pickingImage) {
                  event.stopPropagation();
                  setPickingImage(false);
                }
              }}
            >
              <div className="flex max-h-[92vh] w-[28rem] shrink-0 flex-col overflow-hidden rounded-2xl bg-overlay shadow-overlay">
                {isOpen && (
                  <EditForm
                    {...rest}
                    onClose={close}
                    onEditImage={() => setPickingImage(true)}
                    isPickingImage={pickingImage}
                  />
                )}
              </div>

              <AnimatePresence initial={false}>
                {isOpen && pickingImage && (
                  // Width and margin are animated on the pane itself, which also
                  // carries the card: a box clipping its own children never
                  // clips its own shadow, so the unfold stays clean-edged.
                  <motion.div
                    initial={{ width: 0, marginLeft: 0, opacity: 0 }}
                    animate={{ width: IMAGE_PANE_PX, marginLeft: 12, opacity: 1 }}
                    exit={{ width: 0, marginLeft: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className="max-h-[92vh] shrink-0 overflow-hidden rounded-2xl bg-overlay shadow-overlay"
                  >
                    <div className="flex h-full flex-col" style={{ width: IMAGE_PANE_PX }}>
                      <PlaylistImageStep
                        playlist={rest.playlist}
                        tracks={rest.tracks}
                        onClose={() => setPickingImage(false)}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
