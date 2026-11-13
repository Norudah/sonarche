import { Button, toast } from "@heroui/react";
import { Check, Loader2, Plus } from "lucide-react";
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
import { Dialog } from "@/shared/ui/Dialog";

interface AddToPlaylistDialogProps {
  /** A track or a whole album; null = closed. */
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
      className="group/row flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-colors hover:bg-default/40 focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:hover:bg-transparent"
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

/** Mounted per opening so its state starts clean. */
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
    <>
      <Dialog.Header
        title={t("playlists.addTo")}
        subtitle={t("trackCount", { count: itemIds.length })}
        close={{ label: t("metadata.close"), onPress: onClose }}
      />

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
            className="h-9 min-w-0 flex-1 rounded-xl border border-separator bg-transparent px-3 text-[0.8125rem] outline-none placeholder:text-muted/70 focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent"
          />
          <Button type="submit" variant="primary" isDisabled={trimmed === "" || draftTaken || busy}>
            <Plus className="size-3.5" />
            {t("playlists.createConfirm")}
          </Button>
        </form>
        {/* Reserved height so the list doesn't jump. */}
        <p className="mt-1 min-h-4 text-[0.75rem] text-danger">{draftTaken ? t("playlists.duplicateName") : ""}</p>
      </div>

      <Dialog.Body className="px-3.5 pb-4">
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
      </Dialog.Body>
    </>
  );
}

/** A picker: one click files the tracks. Creating a playlist is inline at the top. */
export function AddToPlaylistDialog({ tracks, onClose }: AddToPlaylistDialogProps) {
  return (
    <Dialog isOpen={tracks != null} onClose={onClose}>
      {tracks != null && <PickerBody tracks={tracks} onClose={onClose} />}
    </Dialog>
  );
}
