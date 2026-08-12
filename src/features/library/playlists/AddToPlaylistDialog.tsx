import { Modal, toast } from "@heroui/react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { useLibrary } from "@/features/library/hooks";
import type { Playlist } from "@/features/library/playlists/api";
import { useAddToPlaylist, useCreatePlaylist, usePlaylists } from "@/features/library/playlists/hooks";
import { PlaylistCoverMosaic } from "@/features/library/playlists/PlaylistCoverMosaic";
import {
  orderedPlaylists,
  playlistCovers,
  playlistNameTaken,
  resolvePlaylistTracks,
  tracksById,
} from "@/features/library/playlists/playlists";
import { TOAST_EXPLAINED, TOAST_GLANCE } from "@/shared/toast/durations";

interface AddToPlaylistDialogProps {
  /** What is being filed — one row's track, or a whole album. Null = closed. */
  tracks: LibraryTrack[] | null;
  onClose: () => void;
}

function PlaylistRow({
  playlist,
  displayName,
  covers,
  memberCount,
  alreadyHasAll,
  isPending,
  onPick,
}: {
  playlist: Playlist;
  displayName: string;
  covers: string[];
  memberCount: number;
  alreadyHasAll: boolean;
  isPending: boolean;
  onPick: () => void;
}) {
  const { t } = useTranslation("library");

  return (
    <button
      type="button"
      disabled={alreadyHasAll || isPending}
      onClick={onPick}
      className="group/row flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-colors hover:bg-default/40 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:hover:bg-transparent"
    >
      <PlaylistCoverMosaic
        covers={covers}
        customUrl={playlist.coverUrl}
        favorites={playlist.kind === "favorites"}
        className="size-10 shrink-0 overflow-hidden rounded-md"
      />
      <span className="min-w-0 flex-1">
        <span className={"block truncate text-sm font-medium " + (alreadyHasAll ? "text-muted" : "text-foreground")}>
          {displayName}
        </span>
        <span className="block truncate text-[0.75rem] text-muted">{t("trackCount", { count: memberCount })}</span>
      </span>
      {isPending ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted" />
      ) : alreadyHasAll ? (
        <span className="flex shrink-0 items-center gap-1.5 text-[0.75rem] text-muted">
          <Check className="size-3.5" />
          {t("playlists.alreadyThere")}
        </span>
      ) : (
        <Plus className="size-4 shrink-0 text-muted opacity-0 transition-opacity group-hover/row:opacity-100" />
      )}
    </button>
  );
}

/** The picker's live half, mounted per opening so its draft and pending state
 * start clean each time without an effect to reset them. */
function PickerBody({ tracks, onClose }: { tracks: LibraryTrack[]; onClose: () => void }) {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const playlists = usePlaylists();
  const add = useAddToPlaylist();
  const create = useCreatePlaylist();
  const [draft, setDraft] = useState("");
  const [pickedId, setPickedId] = useState<number | null>(null);

  const itemIds = tracks.map((track) => track.id);
  const byId = tracksById(library.data ?? []);
  const rows = orderedPlaylists(playlists.data ?? []);
  const busy = add.isPending || create.isPending;

  const finish = (name: string, added: number, skipped: number) => {
    toast(
      added > 0 ? t("playlists.addedToast", { count: added, name }) : t("playlists.nothingAddedToast", { name }),
      skipped > 0 && added > 0
        ? { description: t("playlists.skippedToast", { count: skipped }), timeout: TOAST_EXPLAINED }
        : { timeout: TOAST_GLANCE },
    );
    onClose();
  };

  const pick = (playlist: Playlist) => {
    setPickedId(playlist.id);
    add.mutate(
      { id: playlist.id, itemIds },
      {
        onSuccess: ({ added, skipped }) => finish(playlist.name, added, skipped),
        onError: () => setPickedId(null),
      },
    );
  };

  const trimmed = draft.trim();
  const draftTaken = trimmed !== "" && playlistNameTaken(rows, trimmed, undefined, [t("playlists.favorites")]);
  const createAndAdd = () => {
    if (trimmed === "" || draftTaken || busy) return;
    create.mutate(trimmed, {
      onSuccess: (playlist) => {
        add.mutate(
          { id: playlist.id, itemIds },
          { onSuccess: ({ added, skipped }) => finish(playlist.name, added, skipped) },
        );
      },
    });
  };

  return (
    <div className="flex max-h-[inherit] flex-col">
      <header className="flex shrink-0 items-start gap-3 px-6 pt-5 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">{t("playlists.addTo")}</h2>
          <p className="mt-0.5 truncate text-[0.75rem] text-muted">{t("trackCount", { count: itemIds.length })}</p>
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

      <div className="shrink-0 px-6 pb-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            createAndAdd();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("playlists.createPlaceholder")}
            maxLength={120}
            disabled={busy}
            className="min-w-0 flex-1 rounded-xl border border-separator bg-transparent px-3 py-1.5 text-[0.8125rem] outline-none placeholder:text-muted/70 focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/30"
          />
          <button
            type="submit"
            disabled={trimmed === "" || draftTaken || busy}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-3.5 py-1.5 text-[0.8125rem] font-medium text-accent-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-45"
          >
            <Plus className="size-3.5" />
            {t("playlists.createConfirm")}
          </button>
        </form>
        {/* Reserved so the list below never jumps when it appears. */}
        <p className="mt-1 min-h-4 text-[0.75rem] text-danger">{draftTaken ? t("playlists.duplicateName") : ""}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-4">
        {rows.length === 0 ? (
          <p className="px-2.5 pb-2 text-center text-[0.8125rem] text-muted">{t("playlists.pickerEmpty")}</p>
        ) : (
          rows.map((playlist) => {
            const members = resolvePlaylistTracks(playlist.itemIds, byId);
            const memberSet = new Set(playlist.itemIds);
            return (
              <PlaylistRow
                key={playlist.id}
                playlist={playlist}
                displayName={playlist.kind === "favorites" ? t("playlists.favorites") : playlist.name}
                covers={playlistCovers(members)}
                memberCount={members.length}
                alreadyHasAll={itemIds.length > 0 && itemIds.every((id) => memberSet.has(id))}
                isPending={busy && pickedId === playlist.id}
                onPick={() => pick(playlist)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * "Ajouter à une playlist" — a picker, not a form: click a playlist and it is
 * done, with the create path inline at the top so a first playlist costs no
 * detour through another page.
 */
export function AddToPlaylistDialog({ tracks, onClose }: AddToPlaylistDialogProps) {
  return (
    <Modal
      isOpen={tracks != null}
      onOpenChange={(nowOpen) => {
        if (!nowOpen) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="max-h-[80vh] w-[28rem] max-w-[95vw] rounded-2xl p-0!">
            {tracks != null && <PickerBody tracks={tracks} onClose={onClose} />}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
