import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  albumRecropSource,
  allowCoverPreview,
  listCoverCandidates,
  type CoverCandidate,
  type CoverSource,
} from "@/features/library/api";
import type { Album } from "@/features/library/albums/albums";
import { BeforeAfter, STAGE_PX } from "@/features/library/covers/BeforeAfter";
import { CandidateStrip } from "@/features/library/covers/CandidateStrip";
import { PASTE_CHORD } from "@/features/library/covers/clipboard";
import { cropRect, frameFits, type SourceSize } from "@/features/library/covers/coverCrop";
import { CropWarningSlot } from "@/features/library/covers/CropWarningSlot";
import { formatWeight, useEmbeddedEstimate } from "@/features/library/covers/embeddedWeight";
import { ImageModalShell } from "@/features/library/covers/ImageModalShell";
import { ImagePickStage } from "@/features/library/covers/ImagePickStage";
import { ImageSourceBar } from "@/features/library/covers/ImageSourceBar";
import { RecropButton } from "@/features/library/covers/RecropButton";
import { useLocalImageSource } from "@/features/library/covers/useLocalImageSource";
import { useSetAlbumCover } from "@/features/library/hooks";
import { ArtworkPlaceholder } from "@/features/library/metadata/ArtworkPlaceholder";
import { FieldHelpPopover } from "@/shared/ui/FieldHelp";

/** Replaces an album's cover as a before/after: current cover and its weight
 * on the left; a picked, pasted or dropped image (cropped square) or a CAA
 * upload on the right. Only confirming writes. */
export function CoverReplaceModal({ album, isOpen, onClose }: { album: Album; isOpen: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation("library");
  const replace = useSetAlbumCover();

  const [candidate, setCandidate] = useState<CoverCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentBytes, setCurrentBytes] = useState<number | null>(null);
  const [currentSize, setCurrentSize] = useState<SourceSize | null>(null);
  // The CAA lookup only runs when the user asks.
  const [wantsCandidates, setWantsCandidates] = useState(false);

  const local = useLocalImageSource({
    isOpen,
    filterName: t("albumMetadata.cover.filterName"),
    // A local pick replaces a selected candidate, and vice versa.
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

  // The current cover's weight, read once per opening.
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

  const { image, natural, frame } = local;
  const embeddedEstimate = useEmbeddedEstimate(image, natural, frame);

  const confirm = () => {
    if (albumIds.length === 0) return;
    let wire: CoverSource;
    if (candidate) {
      wire = { candidateUrl: candidate.imageUrl };
    } else if (image && natural) {
      wire = { sourcePath: image.path, crop: cropRect(natural, frame) };
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

  // The actual cropped side, zoom included.
  const squareSide = candidate == null && image && natural ? (cropRect(natural, frame)?.size ?? natural.width) : null;
  // Covers must be square: a frame wider than the picture can't be confirmed.
  const fits = natural == null || frameFits(natural, frame.zoom);
  const canConfirm = (candidate != null || (image != null && natural != null && fits)) && !replace.isPending;

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
        currentAction={
          currentArtPath != null && (
            <RecropButton
              disabled={replace.isPending}
              source={async () => (await albumRecropSource(currentArtPath)).path}
              onAdopt={(path) => local.adopt(path)}
              onFailed={() => setError(t("imageSource.recropFailed"))}
            />
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
              frame={local.frame}
              stagePx={STAGE_PX}
              isDropTarget={local.isDropTarget}
              labels={{
                drop: t("albumMetadata.cover.drop", { chord: PASTE_CHORD }),
                formats: t("albumMetadata.cover.formats"),
                reframe: t("albumMetadata.cover.reframe"),
                zoom: t("albumMetadata.cover.zoom"),
              }}
              onPick={() => void local.pick()}
              onFrame={local.setFrame}
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
                <p className="text-[0.6875rem] text-muted/80">{t("albumMetadata.cover.reframeHint")}</p>
                {squareSide != null && <p>{t("albumMetadata.cover.squareLine", { side: squareSide })}</p>}
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

      <CropWarningSlot
        active={candidate == null && image != null && natural != null}
        warning={
          !fits
            ? t("albumMetadata.cover.notSquare")
            : squareSide != null && squareSide < 500
              ? t("albumMetadata.cover.tooSmall")
              : null
        }
      />

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
