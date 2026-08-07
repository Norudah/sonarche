import { Spinner } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { BeforeAfter, STAGE_PX } from "@/features/library/covers/BeforeAfter";
import { PASTE_CHORD } from "@/features/library/covers/clipboard";
import { cropRect } from "@/features/library/covers/coverCrop";
import { ImageModalShell } from "@/features/library/covers/ImageModalShell";
import { ImagePickStage } from "@/features/library/covers/ImagePickStage";
import { ImageSourceBar } from "@/features/library/covers/ImageSourceBar";
import { useLocalImageSource } from "@/features/library/covers/useLocalImageSource";
import type { Playlist } from "@/features/library/playlists/api";
import { useRemovePlaylistCover, useSetPlaylistCover } from "@/features/library/playlists/hooks";
import { PlaylistCoverMosaic } from "@/features/library/playlists/PlaylistCoverMosaic";
import { playlistCovers } from "@/features/library/playlists/playlists";
import { FieldHelpPopover } from "@/shared/ui/FieldHelp";

/**
 * Give a playlist a tile of its own — the artist modal's twin, square where
 * that one is round. Left, what the shelf draws today: the user's image, or
 * the mosaic standing in. Right, the replacement, arriving by any road the
 * source bar offers. The image lands in the app's own data, never in the
 * library folder — the library stays 100% beets-clean, and a future playlist
 * export can copy the file out from there.
 */
export function PlaylistImageModal({
  playlist,
  displayName,
  tracks,
  isOpen,
  onClose,
}: {
  playlist: Playlist;
  /** The name as shown — the favorites' localized label, not its stored name. */
  displayName: string;
  /** Members resolved against the library, for the mosaic on the left. */
  tracks: LibraryTrack[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("library");
  const replace = useSetPlaylistCover();
  const remove = useRemovePlaylistCover();

  const [error, setError] = useState<string | null>(null);

  const local = useLocalImageSource({
    isOpen,
    filterName: t("albumMetadata.cover.filterName"),
    onAdopt: () => setError(null),
    onUnreadable: () => setError(t("playlists.image.unreadable")),
  });

  const isPending = replace.isPending || remove.isPending;

  const reset = () => {
    local.clear();
    setError(null);
  };

  const close = () => {
    if (isPending) return;
    reset();
    onClose();
  };

  const confirm = () => {
    const { image, natural, offset } = local;
    if (!image || !natural) return;
    setError(null);
    replace.mutate(
      { id: playlist.id, sourcePath: image.path, crop: cropRect(natural, offset) },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
        onError: () => setError(t("playlists.image.failed")),
      },
    );
  };

  const removeCurrent = () => {
    setError(null);
    remove.mutate(playlist.id, {
      onSuccess: () => {
        reset();
        onClose();
      },
      onError: () => setError(t("playlists.image.failed")),
    });
  };

  const canConfirm = local.image != null && local.natural != null && !isPending;

  return (
    <ImageModalShell
      isOpen={isOpen}
      onClose={close}
      title={t("playlists.image.title")}
      subtitle={displayName}
      error={error}
      confirm={{
        label: t("playlists.image.replace"),
        onConfirm: confirm,
        disabled: !canConfirm,
        isPending: replace.isPending,
      }}
      footerStart={
        playlist.coverUrl != null && (
          <button
            type="button"
            disabled={isPending}
            onClick={removeCurrent}
            className="flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium text-danger outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-danger/40 disabled:cursor-default disabled:opacity-45"
          >
            {remove.isPending && <Spinner size="sm" />}
            {t("playlists.image.remove")}
          </button>
        )
      }
    >
      <BeforeAfter
        currentTitle={t("playlists.image.current")}
        current={
          <div style={{ width: STAGE_PX, height: STAGE_PX }}>
            <PlaylistCoverMosaic
              covers={playlistCovers(tracks)}
              customUrl={playlist.coverUrl}
              favorites={playlist.kind === "favorites"}
              className="size-full overflow-hidden rounded-xl ring-1 ring-separator/60"
            />
          </div>
        }
        currentInfo={<p>{playlist.coverUrl ? t("playlists.image.hasCurrent") : t("playlists.image.noCurrent")}</p>}
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
            offset={local.offset}
            stagePx={STAGE_PX}
            isDropTarget={local.isDropTarget}
            labels={{
              drop: t("playlists.image.drop", { chord: PASTE_CHORD }),
              formats: t("albumMetadata.cover.formats"),
              reframe: t("albumMetadata.cover.reframe"),
            }}
            onPick={() => void local.pick()}
            onOffset={local.setOffset}
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
        active={isOpen}
        disabled={isPending}
        onBrowse={() => void local.pick()}
        onAdopt={(path) => local.adopt(path)}
        onNotice={setError}
      />
    </ImageModalShell>
  );
}
