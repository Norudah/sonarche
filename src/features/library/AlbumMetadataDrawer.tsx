import { Drawer, useOverlayState } from "@heroui/react";
import { Loader2, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Album } from "@/features/library/albums/albums";
import {
  type AlbumCommonField,
  type AlbumCommonValues,
  type AlbumDraft,
  artistPropagations,
  buildAlbumUpdates,
  commonBaseline,
  commonGenreBucket,
  toAlbumDraft,
  type TrackRowValues,
} from "@/features/library/albums/albumFields";
import { AlbumArtistPropagation } from "@/features/library/albums/AlbumArtistPropagation";
import { AlbumCommonFields } from "@/features/library/albums/AlbumCommonFields";
import { AlbumCompletionRow } from "@/features/library/albums/AlbumCompletionRow";
import { AlbumInspectHeader } from "@/features/library/albums/AlbumInspectHeader";
import { AlbumTrackFields } from "@/features/library/albums/AlbumTrackFields";
import { HERO_PILL_SECONDARY } from "@/features/library/heroPill";
import { useReenrichAlbum, useUpdateTracks } from "@/features/library/hooks";
import { PrimaryPill } from "@/features/library/metadata/PrimaryPill";
import { springs } from "@/shared/motion/tokens";

function AlbumInspectForm({ album, onClose }: { album: Album; onClose: () => void }) {
  const { t } = useTranslation("library");
  const update = useUpdateTracks();
  const reenrich = useReenrichAlbum();
  const [isEditing, setIsEditing] = useState(false);

  const baseline = useMemo(() => commonBaseline(album.tracks), [album.tracks]);
  // Read mode mirrors the live album; the draft is only the editing buffer,
  // reseeded from the record each time editing starts (so a refetch after save
  // updates the read view without a stale draft lingering).
  const live = useMemo(() => toAlbumDraft(album.tracks, baseline), [album.tracks, baseline]);
  const [draft, setDraft] = useState<AlbumDraft>(live);
  const shown = isEditing ? draft : live;

  const genreBucket = useMemo(() => commonGenreBucket(album.tracks), [album.tracks]);
  // Artist edits worth offering to repeat elsewhere — recomputed off the live
  // draft so a card shrinks (or clears) as the user applies or edits more.
  const propagations = isEditing ? artistPropagations(album.tracks, draft) : [];

  const setCommon = (field: AlbumCommonField, value: string) =>
    setDraft((prev) => ({ ...prev, common: { ...prev.common, [field]: value } }));
  const setRow = (id: number, field: keyof TrackRowValues, value: string) =>
    setDraft((prev) => ({ ...prev, rows: { ...prev.rows, [id]: { ...prev.rows[id], [field]: value } } }));

  const applyPropagation = (ids: number[], artist: string) =>
    setDraft((prev) => {
      const rows = { ...prev.rows };
      for (const id of ids) rows[id] = { ...rows[id], artist };
      return { ...prev, rows };
    });

  // The tracklist popover's fan-out: every row takes the value, and the common
  // field follows so the two views of "the album's genre" cannot disagree.
  const applyGenreToAll = (genre: string) =>
    setDraft((prev) => {
      const rows = { ...prev.rows };
      for (const id of Object.keys(rows)) rows[Number(id)] = { ...rows[Number(id)], genre };
      return { common: { ...prev.common, genre }, rows };
    });

  const startEditing = () => {
    setDraft(live);
    update.reset();
    setIsEditing(true);
  };

  const save = () => {
    const updates = buildAlbumUpdates(album.tracks, baseline, draft);
    if (updates.length === 0) {
      setIsEditing(false);
      return;
    }
    update.mutate(updates, { onSuccess: () => setIsEditing(false) });
  };

  // A save error owns the feedback line; otherwise the re-match result rides it.
  const feedback = update.isError
    ? { text: t("metadata.saveFailed"), tone: "text-danger" }
    : reenrich.isError
      ? { text: t("metadata.reenrichFailed"), tone: "text-danger" }
      : reenrich.isSuccess
        ? {
            text: t("albums.rematchDone", { matched: reenrich.data.matched, total: reenrich.data.total }),
            tone: reenrich.data.matched > 0 ? "text-success" : "text-muted",
          }
        : null;

  return (
    <div data-slot="drawer-body" className="flex h-full flex-col">
      <AlbumInspectHeader album={album} isEditing={isEditing} onClose={onClose} />

      <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-x-hidden overflow-y-auto px-8 py-7">
        <AlbumCompletionRow album={album} />

        <AlbumCommonFields
          baseline={baseline}
          values={shown.common as AlbumCommonValues}
          genreBucket={genreBucket}
          soundtrack={album.tracks.some((track) => track.soundtrack)}
          isEditing={isEditing}
          onChange={setCommon}
        />

        <hr className="border-separator/60" />

        <AlbumTrackFields
          tracks={album.tracks}
          rows={shown.rows}
          isEditing={isEditing}
          genreShared={!baseline.genre.mixed}
          onChange={setRow}
          onApplyGenreAll={applyGenreToAll}
        />

        <AlbumArtistPropagation propagations={propagations} tracks={album.tracks} onApply={applyPropagation} />
      </div>

      <footer className="flex flex-col gap-2.5 border-t border-separator px-8 py-3.5">
        {feedback && <p className={`text-[0.8125rem] ${feedback.tone}`}>{feedback.text}</p>}

        <div className="flex items-center justify-between gap-3">
          {/* Re-match moved here from the album page: it sits where the track
              drawer's own re-match does — left of the action bar, its result on
              the line above. Shares this form's hook so the feedback line reacts. */}
          <button
            type="button"
            disabled={reenrich.isPending}
            onClick={() => reenrich.mutate(album.tracks.map((track) => track.id))}
            className={`${HERO_PILL_SECONDARY} group/rematch cursor-pointer disabled:cursor-default disabled:opacity-60`}
          >
            {reenrich.isPending ? (
              <Loader2 className="size-4 animate-spin text-accent" />
            ) : (
              <Sparkles className="size-4 text-accent transition-transform duration-500 ease-out group-hover/rematch:rotate-180 motion-reduce:transition-none" />
            )}
            {reenrich.isPending ? t("albums.rematching") : t("albums.rematch")}
          </button>

          <div className="flex items-center gap-2.5">
            {isEditing ? (
              <>
                <motion.button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={springs.bouncy}
                  className={`${HERO_PILL_SECONDARY} cursor-pointer`}
                >
                  {t("metadata.cancel")}
                </motion.button>
                <PrimaryPill onPress={save} isPending={update.isPending}>
                  {update.isPending ? t("metadata.saving") : t("metadata.save")}
                </PrimaryPill>
              </>
            ) : (
              <PrimaryPill onPress={startEditing}>{t("metadata.edit")}</PrimaryPill>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

export function AlbumMetadataDrawer({ album, onClose }: { album: Album | null; onClose: () => void }) {
  const state = useOverlayState({
    isOpen: album != null,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  return (
    <Drawer state={state}>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          {/* Wider than the track drawer's 30rem: this one carries a three-column
              editable tracklist under the common-fields block, and wants room to
              breathe. */}
          <Drawer.Dialog className="flex h-full w-[92vw] flex-col overflow-hidden p-0! sm:w-[40rem]">
            {album && <AlbumInspectForm key={album.key} album={album} onClose={onClose} />}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
