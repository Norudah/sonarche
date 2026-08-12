import { Spinner } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ArtistAvatar } from "@/features/library/artists/ArtistAvatar";
import type { Artist } from "@/features/library/artists/artists";
import { BeforeAfter, STAGE_PX } from "@/features/library/covers/BeforeAfter";
import { PASTE_CHORD } from "@/features/library/covers/clipboard";
import { cropRect, frameFits } from "@/features/library/covers/coverCrop";
import { CropWarningSlot } from "@/features/library/covers/CropWarningSlot";
import { ImageModalShell } from "@/features/library/covers/ImageModalShell";
import { ImagePickStage } from "@/features/library/covers/ImagePickStage";
import { ImageSourceBar } from "@/features/library/covers/ImageSourceBar";
import { useLocalImageSource } from "@/features/library/covers/useLocalImageSource";
import { useRemoveArtistImage, useSetArtistImage } from "@/features/library/hooks";
import { FieldHelpPopover } from "@/shared/ui/FieldHelp";

/**
 * Give an artist a picture of their own, stated as a before/after like the
 * cover modal it descends from — same frame, same source bar, same footer.
 *
 * Left, the disc as it is worn today — the user's image, or the generated
 * genre motif standing in. Right, the replacement, arriving by any road the
 * source bar offers, cropped square by moving the frame. Everything
 * album-shaped fell away: no embedding (there is no file), no archive, no
 * online proposals (nothing serves artist photos under a licence we would
 * ship). The image lands in the app's own data, never in the library folder.
 */
export function ArtistImageModal({
  artist,
  imageUrl,
  isOpen,
  onClose,
}: {
  artist: Artist;
  /** What the artist wears today, from `useArtistImages`. */
  imageUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("library");
  const replace = useSetArtistImage();
  const remove = useRemoveArtistImage();

  const [error, setError] = useState<string | null>(null);

  const local = useLocalImageSource({
    isOpen,
    filterName: t("albumMetadata.cover.filterName"),
    onAdopt: () => setError(null),
    onUnreadable: () => setError(t("artists.image.unreadable")),
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
    const { image, natural, frame } = local;
    if (!image || !natural) return;
    setError(null);
    replace.mutate(
      { name: artist.name, sourcePath: image.path, crop: cropRect(natural, frame) },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
        onError: () => setError(t("artists.image.failed")),
      },
    );
  };

  const removeCurrent = () => {
    setError(null);
    remove.mutate(artist.name, {
      onSuccess: () => {
        reset();
        onClose();
      },
      onError: () => setError(t("artists.image.failed")),
    });
  };

  const squareSide = local.image && local.natural ? (cropRect(local.natural, local.frame)?.size ?? null) : null;
  // Same rule as a cover: a frame wider than the picture comes back
  // letterboxed, and the disc is drawn from a square.
  const fits = local.natural == null || frameFits(local.natural, local.frame.zoom);
  const canConfirm = local.image != null && local.natural != null && fits && !isPending;

  return (
    <ImageModalShell
      isOpen={isOpen}
      onClose={close}
      title={t("artists.image.title")}
      subtitle={artist.name}
      error={error}
      confirm={{
        label: t("artists.image.replace"),
        onConfirm: confirm,
        disabled: !canConfirm,
        isPending: replace.isPending,
      }}
      footerStart={
        imageUrl != null && (
          <button
            type="button"
            disabled={isPending}
            onClick={removeCurrent}
            className="flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium text-danger outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-danger/40 disabled:cursor-default disabled:opacity-45"
          >
            {remove.isPending && <Spinner size="sm" />}
            {t("artists.image.remove")}
          </button>
        )
      }
    >
      <BeforeAfter
        currentTitle={t("artists.image.current")}
        current={
          <div style={{ width: STAGE_PX, height: STAGE_PX }}>
            <ArtistAvatar imageUrl={imageUrl} className="size-full ring-1 ring-separator/60" />
          </div>
        }
        currentInfo={<p>{imageUrl ? t("artists.image.hasCurrent") : t("artists.image.noCurrent")}</p>}
        nextTitle={t("artists.image.next")}
        help={
          <FieldHelpPopover
            label={t("metadata.help.open", { field: t("artists.image.title") })}
            title={t("artists.image.help.title")}
          >
            <p className="text-[0.75rem] leading-relaxed text-muted">{t("artists.image.help.storage")}</p>
            <p className="text-[0.75rem] leading-relaxed text-muted">{t("artists.image.help.display")}</p>
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
              drop: t("artists.image.drop", { chord: PASTE_CHORD }),
              formats: t("albumMetadata.cover.formats"),
              reframe: t("albumMetadata.cover.reframe"),
              zoom: t("albumMetadata.cover.zoom"),
            }}
            round
            onPick={() => void local.pick()}
            onFrame={local.setFrame}
            onNatural={local.setNatural}
            onUnreadable={() => {
              local.clear();
              setError(t("artists.image.unreadable"));
            }}
          />
        }
        nextInfo={
          local.image &&
          local.natural && (
            <>
              <p>
                {t("albumMetadata.cover.sourceLine")}{" "}
                <span className="text-foreground tabular-nums">
                  {local.natural.width}×{local.natural.height} px
                </span>
              </p>
              <p className="text-[0.6875rem] text-muted/80">{t("albumMetadata.cover.reframeHint")}</p>
            </>
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

      <CropWarningSlot
        active={local.image != null && local.natural != null}
        warning={
          !fits
            ? t("albumMetadata.cover.notSquare")
            : squareSide != null && squareSide < 500
              ? t("artists.image.tooSmall")
              : null
        }
      />
    </ImageModalShell>
  );
}
