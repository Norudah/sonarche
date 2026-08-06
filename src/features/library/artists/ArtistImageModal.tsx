import { Modal, Spinner } from "@heroui/react";
import { MoveRight, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ArtistAvatar } from "@/features/library/artists/ArtistAvatar";
import type { Artist } from "@/features/library/artists/artists";
import { cropRect } from "@/features/library/covers/coverCrop";
import { ImagePickStage } from "@/features/library/covers/ImagePickStage";
import { useLocalImageSource } from "@/features/library/covers/useLocalImageSource";
import { useRemoveArtistImage, useSetArtistImage } from "@/features/library/hooks";
import { FieldHelpPopover } from "@/shared/ui/FieldHelp";

/**
 * Give an artist a picture of their own, stated as a before/after like the
 * cover modal it descends from.
 *
 * Left, the disc as it is worn today — the user's image, or the generated
 * genre motif standing in. Right, the replacement: a local image, picked or
 * dropped, cropped square by moving the frame. Everything album-shaped fell
 * away: no embedding (there is no file), no archive, no online proposals
 * (nothing serves artist photos under a licence we would ship). The image
 * lands in the app's own data, never in the library folder.
 */

const STAGE_PX = 280;

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
    const { image, natural, offset } = local;
    if (!image || !natural) return;
    setError(null);
    replace.mutate(
      { name: artist.name, sourcePath: image.path, crop: cropRect(natural, offset) },
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

  const squareSide = local.image && local.natural ? Math.min(local.natural.width, local.natural.height) : null;
  const canConfirm = local.image != null && local.natural != null && !isPending;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nowOpen) => {
        if (!nowOpen) close();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="max-h-[92vh] w-[46rem] max-w-[95vw] p-0!">
            <div className="flex max-h-[inherit] flex-col">
              <header className="flex shrink-0 items-start gap-3 border-b border-separator px-6 py-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                    {t("artists.image.title")}
                  </h2>
                  <p className="mt-0.5 truncate text-[0.75rem] text-muted">{artist.name}</p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label={t("metadata.close")}
                  className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-default/60 text-muted outline-none transition-colors hover:bg-default hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <X className="size-3.5" />
                </button>
              </header>

              <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
                <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
                  {/* Before: the disc as the shelf draws it today. */}
                  <section className="flex flex-col items-center gap-2.5">
                    <h3 className="self-start text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">
                      {t("artists.image.current")}
                    </h3>
                    <div style={{ width: STAGE_PX, height: STAGE_PX }}>
                      <ArtistAvatar
                        family={artist.family}
                        imageUrl={imageUrl}
                        className="size-full ring-1 ring-separator/60"
                      />
                    </div>
                    <div className="w-full text-[0.75rem] leading-relaxed text-muted">
                      <p>{imageUrl ? t("artists.image.hasCurrent") : t("artists.image.noCurrent")}</p>
                    </div>
                  </section>

                  <MoveRight className="mt-32 size-5 shrink-0 text-muted/50" />

                  {/* After: the picture the disc will wear. */}
                  <section className="flex flex-col items-center gap-2.5">
                    <h3 className="flex items-center gap-1.5 self-start text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">
                      {t("artists.image.next")}
                      <FieldHelpPopover
                        label={t("metadata.help.open", { field: t("artists.image.title") })}
                        title={t("artists.image.help.title")}
                      >
                        <p className="text-[0.75rem] leading-relaxed text-muted">{t("artists.image.help.storage")}</p>
                        <p className="text-[0.75rem] leading-relaxed text-muted">{t("artists.image.help.display")}</p>
                      </FieldHelpPopover>
                    </h3>

                    <ImagePickStage
                      image={local.image}
                      natural={local.natural}
                      offset={local.offset}
                      stagePx={STAGE_PX}
                      isDropTarget={local.isDropTarget}
                      labels={{
                        drop: t("artists.image.drop"),
                        formats: t("albumMetadata.cover.formats"),
                        reframe: t("albumMetadata.cover.reframe"),
                      }}
                      round
                      onPick={() => void local.pick()}
                      onOffset={local.setOffset}
                      onNatural={local.setNatural}
                      onUnreadable={() => {
                        local.clear();
                        setError(t("artists.image.unreadable"));
                      }}
                    />

                    <div className="w-full text-[0.75rem] leading-relaxed text-muted">
                      {local.image && local.natural && (
                        <>
                          <p>
                            {t("albumMetadata.cover.sourceLine")}{" "}
                            <span className="text-foreground tabular-nums">
                              {local.natural.width}×{local.natural.height} px
                            </span>
                          </p>
                          {local.natural.width !== local.natural.height && (
                            <p className="text-[0.6875rem] text-muted/80">{t("albumMetadata.cover.reframeHint")}</p>
                          )}
                        </>
                      )}
                      {local.image != null && (
                        <button
                          type="button"
                          onClick={() => void local.pick()}
                          className="mt-1 cursor-pointer text-[0.75rem] font-medium text-accent outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                          {t("albumMetadata.cover.pickAnother")}
                        </button>
                      )}
                    </div>
                  </section>
                </div>

                {squareSide != null && squareSide < 500 && (
                  <p className="rounded-xl border border-dashed border-warning/45 bg-warning-soft px-3 py-2 text-[0.75rem] leading-snug text-warning">
                    {t("artists.image.tooSmall")}
                  </p>
                )}

                {error && <p className="text-center text-[0.75rem] text-danger">{error}</p>}
              </div>

              <footer className="flex shrink-0 items-center gap-2 border-t border-separator px-6 py-3.5">
                {imageUrl != null && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={removeCurrent}
                    className="flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium text-danger outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-danger/40 disabled:cursor-default disabled:opacity-45"
                  >
                    {remove.isPending && <Spinner size="sm" />}
                    {t("artists.image.remove")}
                  </button>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={close}
                  className="cursor-pointer rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {t("albumMetadata.cover.cancel")}
                </button>
                <button
                  type="button"
                  disabled={!canConfirm}
                  onClick={confirm}
                  className="flex cursor-pointer items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-[0.8125rem] font-medium text-accent-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-45"
                >
                  {replace.isPending && <Spinner size="sm" />}
                  {t("artists.image.replace")}
                </button>
              </footer>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
