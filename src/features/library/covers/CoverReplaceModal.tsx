import { Modal, Slider, Spinner } from "@heroui/react";
import { open } from "@tauri-apps/plugin-dialog";
import { ImagePlus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { allowCoverPreview } from "@/features/library/api";
import type { Album } from "@/features/library/albums/albums";
import { clampOffset, cropRect, previewShift } from "@/features/library/covers/coverCrop";
import { useSetAlbumCover } from "@/features/library/hooks";
import { FieldHelpPopover } from "@/shared/ui/FieldHelp";

/**
 * Replace an album's cover with an image from disk.
 *
 * Covers are square in every frame the app draws, so a non-square image is
 * cropped rather than letterboxed — the preview *is* the crop, and the one
 * choice offered is where the square sits along the long axis. The modal also
 * says exactly what the replacement writes and at what cost: the original is
 * archived full-size once, and only the 500 px rendition travels into the
 * audio files, so a 3000×3000 scan never weighs down every track.
 */

interface PickedSource {
  path: string;
  url: string;
  bytes: number;
}

interface SourceSize {
  width: number;
  height: number;
}

const PREVIEW_PX = 288;

export function CoverReplaceModal({ album, isOpen, onClose }: { album: Album; isOpen: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation("library");
  const replace = useSetAlbumCover();

  const [source, setSource] = useState<PickedSource | null>(null);
  const [natural, setNatural] = useState<SourceSize | null>(null);
  const [offset, setOffset] = useState(0.5);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSource(null);
    setNatural(null);
    setOffset(0.5);
    setError(null);
  };

  const close = () => {
    if (replace.isPending) return;
    reset();
    onClose();
  };

  const pick = async () => {
    setError(null);
    const chosen = await open({
      multiple: false,
      filters: [{ name: t("albumMetadata.cover.filterName"), extensions: ["jpg", "jpeg", "png", "webp"] }],
    });
    if (typeof chosen !== "string") return;
    try {
      const admitted = await allowCoverPreview(chosen);
      setSource(admitted);
      setNatural(null);
      setOffset(0.5);
    } catch {
      setError(t("albumMetadata.cover.unreadable"));
    }
  };

  const confirm = () => {
    if (!source || !natural) return;
    const albumIds = [...new Set(album.tracks.map((track) => track.albumId).filter((id): id is number => id != null))];
    if (albumIds.length === 0) {
      setError(t("albumMetadata.cover.noAlbumRow"));
      return;
    }
    setError(null);
    replace.mutate(
      { albumIds, sourcePath: source.path, crop: cropRect(natural, offset) },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
        onError: () => setError(t("albumMetadata.cover.failed")),
      },
    );
  };

  const landscape = natural != null && natural.width > natural.height;
  const shift = natural ? previewShift(natural, offset) : 0;
  const squareSide = natural ? Math.min(natural.width, natural.height) : null;
  const megabytes = source
    ? new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(source.bytes / 1_048_576)
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nowOpen) => {
        if (!nowOpen) close();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="max-h-[92vh] w-[26rem] p-0!">
            <div className="flex max-h-[inherit] flex-col">
              <header className="flex shrink-0 items-start gap-3 border-b border-separator px-5 py-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                    {t("albumMetadata.cover.title")}
                  </h2>
                  <p className="mt-0.5 truncate text-[0.75rem] text-muted">
                    {album.title} — {album.artist}
                  </p>
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

              <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto px-5 py-4">
                {source ? (
                  <>
                    <div
                      className="relative overflow-hidden rounded-xl bg-default/40 ring-1 ring-artwork-edge"
                      style={{ width: PREVIEW_PX, height: PREVIEW_PX }}
                    >
                      <img
                        src={source.url}
                        alt=""
                        onLoad={(event) => {
                          const img = event.currentTarget;
                          setNatural({ width: img.naturalWidth, height: img.naturalHeight });
                        }}
                        onError={() => {
                          setSource(null);
                          setError(t("albumMetadata.cover.unreadable"));
                        }}
                        className={landscape ? "h-full max-w-none" : "w-full"}
                        style={{
                          transform: landscape ? `translateX(-${shift * 100}%)` : `translateY(-${shift * 100}%)`,
                        }}
                        draggable={false}
                      />
                    </div>

                    {natural != null && natural.width !== natural.height && (
                      <div className="flex w-full flex-col gap-1">
                        <Slider
                          aria-label={t("albumMetadata.cover.reframe")}
                          value={Math.round(clampOffset(offset) * 100)}
                          minValue={0}
                          maxValue={100}
                          step={1}
                          onChange={(next) => setOffset((next as number) / 100)}
                        >
                          <Slider.Track>
                            <Slider.Fill />
                            <Slider.Thumb />
                          </Slider.Track>
                        </Slider>
                        <p className="text-center text-[0.6875rem] text-muted">
                          {t("albumMetadata.cover.reframeHint")}
                        </p>
                      </div>
                    )}

                    {natural != null && (
                      <div className="flex w-full flex-col gap-1.5 rounded-xl bg-default/40 px-3.5 py-2.5 text-[0.75rem] text-muted">
                        <div className="flex items-center justify-between gap-2">
                          <span>{t("albumMetadata.cover.sourceLine")}</span>
                          <span className="text-foreground tabular-nums">
                            {natural.width}×{natural.height} px · {megabytes} {t("albumMetadata.cover.mb")}
                          </span>
                        </div>
                        {squareSide != null && (
                          <div className="flex items-center justify-between gap-2">
                            <span>{t("albumMetadata.cover.archiveLine")}</span>
                            <span className="text-foreground tabular-nums">
                              {squareSide}×{squareSide} px
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5">
                            {t("albumMetadata.cover.embeddedLine")}
                            <FieldHelpPopover
                              label={t("metadata.help.open", { field: t("albumMetadata.cover.title") })}
                              title={t("albumMetadata.cover.help.title")}
                            >
                              <p className="text-[0.75rem] leading-relaxed text-muted">
                                {t("albumMetadata.cover.help.embed")}
                              </p>
                              <p className="text-[0.75rem] leading-relaxed text-muted">
                                {t("albumMetadata.cover.help.weight")}
                              </p>
                              <p className="text-[0.75rem] leading-relaxed text-muted">
                                {t("albumMetadata.cover.help.archive")}
                              </p>
                            </FieldHelpPopover>
                          </span>
                          <span className="text-foreground tabular-nums">
                            {Math.min(squareSide ?? 500, 500)}×{Math.min(squareSide ?? 500, 500)} px
                          </span>
                        </div>
                      </div>
                    )}

                    {squareSide != null && squareSide < 500 && (
                      <p className="w-full rounded-xl border border-dashed border-warning/45 bg-warning-soft px-3 py-2 text-[0.75rem] leading-snug text-warning">
                        {t("albumMetadata.cover.tooSmall")}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={pick}
                      className="cursor-pointer text-[0.75rem] font-medium text-accent outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      {t("albumMetadata.cover.pickAnother")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={pick}
                    className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-separator text-muted outline-none transition-colors hover:border-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
                    style={{ width: PREVIEW_PX, height: PREVIEW_PX }}
                  >
                    <ImagePlus className="size-7 opacity-60" />
                    <span className="text-[0.8125rem] font-medium">{t("albumMetadata.cover.pick")}</span>
                    <span className="text-[0.6875rem] opacity-70">{t("albumMetadata.cover.formats")}</span>
                  </button>
                )}

                {error && <p className="w-full text-center text-[0.75rem] text-danger">{error}</p>}
              </div>

              <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-separator px-5 py-3.5">
                <button
                  type="button"
                  onClick={close}
                  className="cursor-pointer rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {t("albumMetadata.cover.cancel")}
                </button>
                <button
                  type="button"
                  disabled={!source || natural == null || replace.isPending}
                  onClick={confirm}
                  className="flex cursor-pointer items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-[0.8125rem] font-medium text-accent-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-45"
                >
                  {replace.isPending && <Spinner size="sm" />}
                  {t("albumMetadata.cover.replace")}
                </button>
              </footer>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
