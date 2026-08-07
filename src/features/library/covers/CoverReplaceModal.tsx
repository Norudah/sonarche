import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { allowCoverPreview, listCoverCandidates, type CoverCandidate, type CoverSource } from "@/features/library/api";
import type { Album } from "@/features/library/albums/albums";
import { BeforeAfter, STAGE_PX } from "@/features/library/covers/BeforeAfter";
import { CandidateStrip } from "@/features/library/covers/CandidateStrip";
import { PASTE_CHORD } from "@/features/library/covers/clipboard";
import { cropRect, type SourceSize } from "@/features/library/covers/coverCrop";
import { ImageModalShell } from "@/features/library/covers/ImageModalShell";
import { ImagePickStage } from "@/features/library/covers/ImagePickStage";
import { ImageSourceBar } from "@/features/library/covers/ImageSourceBar";
import { useLocalImageSource } from "@/features/library/covers/useLocalImageSource";
import { useSetAlbumCover } from "@/features/library/hooks";
import { ArtworkPlaceholder } from "@/features/library/metadata/ArtworkPlaceholder";
import { FieldHelpPopover } from "@/shared/ui/FieldHelp";

/**
 * Replace an album's cover, stated as a before/after.
 *
 * Left, what the album wears today and what it costs (the display file, and
 * its embedded copy across every m4a). Right, the replacement, arriving by any
 * road the source bar offers — a picked or dropped file, a pasted link, the
 * clipboard — cropped square by moving the frame itself, with its resulting
 * weights estimated before anything is written; or one of the Cover Art
 * Archive's own uploads for the release, the way back to an official cover.
 * Confirming is the only step that writes.
 */

function formatWeight(bytes: number, locale: string, mb: string, kb: string): string {
  const format = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value);
  return bytes >= 1_048_576 ? `${format(bytes / 1_048_576)} ${mb}` : `${format(Math.max(1, bytes / 1024))} ${kb}`;
}

/** What the 500px embedded rendition of this crop would weigh, measured by
 * actually encoding it in the webview. An asset-protocol image can taint the
 * canvas depending on CORS headers, so failure is an answer too. */
async function estimateEmbeddedBytes(
  url: string,
  crop: { left: number; top: number; size: number },
  isPng: boolean,
): Promise<number | null> {
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = url;
    await image.decode();
    const side = Math.min(500, crop.size);
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, crop.left, crop.top, crop.size, crop.size, 0, 0, side, side);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, isPng ? "image/png" : "image/jpeg", 0.92),
    );
    return blob?.size ?? null;
  } catch {
    return null;
  }
}

export function CoverReplaceModal({ album, isOpen, onClose }: { album: Album; isOpen: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation("library");
  const replace = useSetAlbumCover();

  const [candidate, setCandidate] = useState<CoverCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentBytes, setCurrentBytes] = useState<number | null>(null);
  const [currentSize, setCurrentSize] = useState<SourceSize | null>(null);
  const [embeddedEstimate, setEmbeddedEstimate] = useState<number | null>(null);
  // The online lookup is the user's move, never the modal's: opening it must
  // not cost a network round-trip to the Cover Art Archive.
  const [wantsCandidates, setWantsCandidates] = useState(false);

  const local = useLocalImageSource({
    isOpen,
    filterName: t("albumMetadata.cover.filterName"),
    // A local pick supersedes a selected candidate, and vice versa below.
    onAdopt: () => {
      setError(null);
      setCandidate(null);
    },
    onUnreadable: () => setError(t("albumMetadata.cover.unreadable")),
  });

  const albumIds = [...new Set(album.tracks.map((track) => track.albumId).filter((id): id is number => id != null))];
  const embedCount = album.tracks.filter((track) => track.path.toLowerCase().endsWith(".m4a")).length;
  const weight = (bytes: number) =>
    formatWeight(bytes, i18n.language, t("albumMetadata.cover.mb"), t("albumMetadata.cover.kb"));

  const candidatesQuery = useQuery({
    queryKey: ["cover-candidates", albumIds[0] ?? 0],
    queryFn: () => listCoverCandidates(albumIds[0]),
    enabled: isOpen && wantsCandidates && albumIds.length > 0,
    staleTime: Infinity,
    retry: 1,
  });

  const reset = () => {
    local.clear();
    setCandidate(null);
    setError(null);
    setWantsCandidates(false);
  };

  const close = () => {
    if (replace.isPending) return;
    reset();
    onClose();
  };

  // The current cover's weight, read once per opening — it feeds the "what it
  // costs today" line the comparison is anchored to.
  const currentArtPath = album.tracks.find((track) => track.artPath)?.artPath ?? null;
  useEffect(() => {
    if (!isOpen || !currentArtPath) return;
    let stale = false;
    allowCoverPreview(currentArtPath)
      .then(({ bytes }) => {
        if (!stale) setCurrentBytes(bytes);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [isOpen, currentArtPath]);

  // Estimated embedded weight of the crop, re-measured shortly after the frame
  // settles — an encode per keypress would churn for nothing.
  const { image, natural, offset } = local;
  useEffect(() => {
    if (!image || !natural) {
      setEmbeddedEstimate(null);
      return;
    }
    const crop = cropRect(natural, offset) ?? { left: 0, top: 0, size: natural.width };
    let stale = false;
    const timer = window.setTimeout(async () => {
      const bytes = await estimateEmbeddedBytes(image.url, crop, image.path.toLowerCase().endsWith(".png"));
      if (!stale) setEmbeddedEstimate(bytes);
    }, 250);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [image, natural, offset]);

  const confirm = () => {
    if (albumIds.length === 0) return;
    let wire: CoverSource;
    if (candidate) {
      wire = { candidateUrl: candidate.imageUrl };
    } else if (image && natural) {
      wire = { sourcePath: image.path, crop: cropRect(natural, offset) };
    } else {
      return;
    }
    setError(null);
    replace.mutate(
      { albumIds, source: wire },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
        onError: () => setError(t("albumMetadata.cover.failed")),
      },
    );
  };

  const squareSide = candidate == null && image && natural ? Math.min(natural.width, natural.height) : null;
  const canConfirm = (candidate != null || (image != null && natural != null)) && !replace.isPending;

  return (
    <ImageModalShell
      isOpen={isOpen}
      onClose={close}
      title={t("albumMetadata.cover.title")}
      subtitle={`${album.title} — ${album.artist}`}
      error={error}
      confirm={{
        label: t("albumMetadata.cover.replace"),
        onConfirm: confirm,
        disabled: !canConfirm,
        isPending: replace.isPending,
      }}
    >
      <BeforeAfter
        currentTitle={t("albumMetadata.cover.current")}
        current={
          album.artUrl ? (
            <img
              src={album.artUrl}
              alt=""
              onLoad={(event) =>
                setCurrentSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              className="rounded-xl object-cover ring-1 ring-artwork-edge"
              style={{ width: STAGE_PX, height: STAGE_PX }}
            />
          ) : (
            <div style={{ width: STAGE_PX, height: STAGE_PX }}>
              <ArtworkPlaceholder className="size-full rounded-xl" />
            </div>
          )
        }
        currentInfo={
          album.artUrl ? (
            <>
              <p>
                {currentSize && `${currentSize.width}×${currentSize.height} px`}
                {currentSize && currentBytes != null && " · "}
                {currentBytes != null && weight(currentBytes)}
              </p>
              {embedCount > 0 && currentBytes != null && (
                <p>
                  {t("albumMetadata.cover.currentEmbedded", {
                    count: embedCount,
                    total: weight(currentBytes * embedCount),
                  })}
                </p>
              )}
            </>
          ) : (
            <p>{t("albumMetadata.cover.noCurrent")}</p>
          )
        }
        nextTitle={t("albumMetadata.cover.next")}
        help={
          <FieldHelpPopover
            label={t("metadata.help.open", { field: t("albumMetadata.cover.title") })}
            title={t("albumMetadata.cover.help.title")}
          >
            <p className="text-[0.75rem] leading-relaxed text-muted">{t("albumMetadata.cover.help.embed")}</p>
            <p className="text-[0.75rem] leading-relaxed text-muted">{t("albumMetadata.cover.help.weight")}</p>
            <p className="text-[0.75rem] leading-relaxed text-muted">{t("albumMetadata.cover.help.archive")}</p>
          </FieldHelpPopover>
        }
        next={
          candidate ? (
            <img
              src={candidate.thumb}
              alt=""
              className={`rounded-xl object-cover ring-1 ring-artwork-edge ${local.isDropTarget ? "ring-2 ring-accent" : ""}`}
              style={{ width: STAGE_PX, height: STAGE_PX }}
            />
          ) : (
            <ImagePickStage
              image={local.image}
              natural={local.natural}
              offset={local.offset}
              stagePx={STAGE_PX}
              isDropTarget={local.isDropTarget}
              labels={{
                drop: t("albumMetadata.cover.drop", { chord: PASTE_CHORD }),
                formats: t("albumMetadata.cover.formats"),
                reframe: t("albumMetadata.cover.reframe"),
              }}
              onPick={() => void local.pick()}
              onOffset={local.setOffset}
              onNatural={local.setNatural}
              onUnreadable={() => {
                local.clear();
                setError(t("albumMetadata.cover.unreadable"));
              }}
            />
          )
        }
        nextInfo={
          <>
            {candidate == null && image && natural && (
              <>
                <p>
                  {t("albumMetadata.cover.sourceLine")}{" "}
                  <span className="text-foreground tabular-nums">
                    {natural.width}×{natural.height} px · {weight(image.bytes)}
                  </span>
                </p>
                {natural.width !== natural.height && (
                  <p className="text-[0.6875rem] text-muted/80">{t("albumMetadata.cover.reframeHint")}</p>
                )}
                {squareSide != null && <p>{t("albumMetadata.cover.archiveLine", { side: squareSide })}</p>}
                {embedCount > 0 && (
                  <p>
                    {embeddedEstimate != null
                      ? t("albumMetadata.cover.nextEmbedded", {
                          count: embedCount,
                          each: weight(embeddedEstimate),
                          total: weight(embeddedEstimate * embedCount),
                        })
                      : t("albumMetadata.cover.nextEmbeddedUnknown", { count: embedCount })}
                  </p>
                )}
              </>
            )}
            {candidate != null && <p>{t("albumMetadata.cover.candidateNote")}</p>}
          </>
        }
      />

      <ImageSourceBar
        active={isOpen}
        disabled={replace.isPending}
        onBrowse={() => void local.pick()}
        onAdopt={(path) => local.adopt(path)}
        onNotice={setError}
      />

      {squareSide != null && squareSide < 500 && (
        <p className="rounded-xl border border-dashed border-warning/45 bg-warning-soft px-3 py-2 text-[0.75rem] leading-snug text-warning">
          {t("albumMetadata.cover.tooSmall")}
        </p>
      )}

      {albumIds.length > 0 && (
        <CandidateStrip
          hasSearched={wantsCandidates}
          candidates={candidatesQuery.data}
          isLoading={candidatesQuery.isLoading}
          isError={candidatesQuery.isError}
          selectedId={candidate?.id ?? null}
          onSearch={() => setWantsCandidates(true)}
          onSelect={(picked) => {
            setError(null);
            local.clear();
            setCandidate(picked);
          }}
          onRetry={() => void candidatesQuery.refetch()}
        />
      )}
    </ImageModalShell>
  );
}
