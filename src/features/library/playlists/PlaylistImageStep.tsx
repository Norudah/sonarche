import { Spinner } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { BeforeAfter } from "@/features/library/covers/BeforeAfter";
import { PASTE_CHORD } from "@/features/library/covers/clipboard";
import { cropRect, frameFits } from "@/features/library/covers/coverCrop";
import { CropWarningSlot } from "@/features/library/covers/CropWarningSlot";
import { ImagePickStage } from "@/features/library/covers/ImagePickStage";
import { ImageSourceBar } from "@/features/library/covers/ImageSourceBar";
import { RecropButton } from "@/features/library/covers/RecropButton";
import { useLocalImageSource } from "@/features/library/covers/useLocalImageSource";
import type { Playlist } from "@/features/library/playlists/api";
import { useRemovePlaylistCover, useSetPlaylistCover } from "@/features/library/playlists/hooks";
import {
  EditDialogHeader,
  EDIT_DIALOG_BODY,
  EDIT_DIALOG_CONFIRM_BUTTON,
  EDIT_DIALOG_FOOTER,
} from "@/features/library/playlists/PlaylistEditChrome";
import { PlaylistCoverMosaic } from "@/features/library/playlists/PlaylistCoverMosaic";
import { playlistCovers } from "@/features/library/playlists/playlists";
import { FieldHelpPopover } from "@/shared/ui/FieldHelp";

/** Narrower than other stages: this pane sits beside the form. */
const STAGE_PX = 220;

/** Sets a playlist's tile: current image or mosaic on the left, the
 * replacement on the right. Applies immediately, not as part of the form's
 * draft. Closed by the header's cross. */
export function PlaylistImageStep({
  playlist,
  tracks,
  onClose,
}: {
  playlist: Playlist;
  /** Members, for the mosaic. */
  tracks: LibraryTrack[];
  onClose: () => void;
}) {
  const { t } = useTranslation("library");
  const replace = useSetPlaylistCover();
  const remove = useRemovePlaylistCover();

  const [error, setError] = useState<string | null>(null);

  const local = useLocalImageSource({
    isOpen: true,
    filterName: t("albumMetadata.cover.filterName"),
    onAdopt: () => setError(null),
    onUnreadable: () => setError(t("playlists.image.unreadable")),
  });

  const isPending = replace.isPending || remove.isPending;

  const confirm = () => {
    const { image, natural, frame } = local;
    if (!image || !natural) return;
    setError(null);
    replace.mutate(
      { id: playlist.id, sourcePath: image.path, crop: cropRect(natural, frame) },
      { onSuccess: onClose, onError: () => setError(t("playlists.image.failed")) },
    );
  };

  const removeCurrent = () => {
    setError(null);
    remove.mutate(playlist.id, { onSuccess: onClose, onError: () => setError(t("playlists.image.failed")) });
  };

  // The tile is square, so the frame must fit the picture.
  const fits = local.natural == null || frameFits(local.natural, local.frame.zoom);
  const canConfirm = local.image != null && local.natural != null && fits && !isPending;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EditDialogHeader title={t("playlists.image.title")} subtitle={playlist.name} onClose={onClose} />

      <div className={EDIT_DIALOG_BODY}>
        <BeforeAfter
          currentTitle={t("playlists.image.current")}
          current={
            <div style={{ width: STAGE_PX, height: STAGE_PX }}>
              <PlaylistCoverMosaic
                covers={playlistCovers(tracks)}
                customUrl={playlist.coverUrl}
                className="size-full overflow-hidden rounded-xl ring-1 ring-separator/60"
              />
            </div>
          }
          currentInfo={<p>{playlist.coverUrl ? t("playlists.image.hasCurrent") : t("playlists.image.noCurrent")}</p>}
          currentAction={
            playlist.coverPath != null && (
              <RecropButton
                disabled={isPending}
                source={async () => playlist.coverPath ?? ""}
                onAdopt={(path) => local.adopt(path)}
                onFailed={() => setError(t("imageSource.recropFailed"))}
              />
            )
          }
          nextTitle={t("playlists.image.next")}
          help={
            <FieldHelpPopover
              label={t("metadata.help.open", { field: t("playlists.image.title") })}
              title={t("playlists.image.help.title")}
            >
              <p className="text-[0.75rem] leading-relaxed text-muted">{t("playlists.image.help.storage")}</p>
              <p className="text-[0.75rem] leading-relaxed text-muted">{t("playlists.image.help.display")}</p>
            </FieldHelpPopover>
          }
          next={
            <ImagePickStage
              image={local.image}
              natural={local.natural}
              frame={local.frame}
              stagePx={STAGE_PX}
              isDropTarget={local.isDropTarget}
              labels={{
                drop: t("playlists.image.drop", { chord: PASTE_CHORD }),
                formats: t("albumMetadata.cover.formats"),
                reframe: t("albumMetadata.cover.reframe"),
                zoom: t("albumMetadata.cover.zoom"),
              }}
              onPick={() => void local.pick()}
              onFrame={local.setFrame}
              onNatural={local.setNatural}
              onUnreadable={() => {
                local.clear();
                setError(t("playlists.image.unreadable"));
              }}
            />
          }
          nextInfo={
            local.image &&
            local.natural && (
              <p>
                {t("albumMetadata.cover.sourceLine")}{" "}
                <span className="text-foreground tabular-nums">
                  {local.natural.width}×{local.natural.height} px
                </span>
              </p>
            )
          }
        />

        <ImageSourceBar
          active
          disabled={isPending}
          onBrowse={() => void local.pick()}
          onAdopt={(path) => local.adopt(path)}
          onNotice={setError}
        />

        <CropWarningSlot
          active={local.image != null && local.natural != null}
          warning={fits ? null : t("albumMetadata.cover.notSquare")}
        />

        {error && <p className="text-center text-[0.75rem] text-danger">{error}</p>}
      </div>

      <footer className={EDIT_DIALOG_FOOTER}>
        {playlist.coverUrl != null && (
          <button
            type="button"
            disabled={isPending}
            onClick={removeCurrent}
            className="flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium text-danger outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-danger/40 disabled:cursor-default disabled:opacity-45"
          >
            {remove.isPending && <Spinner size="sm" />}
            {t("playlists.image.remove")}
          </button>
        )}
        <div className="flex-1" />
        <button type="button" disabled={!canConfirm} onClick={confirm} className={EDIT_DIALOG_CONFIRM_BUTTON}>
          {replace.isPending && <Spinner size="sm" />}
          {t("playlists.image.replace")}
        </button>
      </footer>
    </div>
  );
}
