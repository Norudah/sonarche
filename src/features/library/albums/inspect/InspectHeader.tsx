import { ImagePlus } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Album } from "@/features/library/albums/albums";
import { ArtistImageButton } from "@/features/library/artists/ArtistImageButton";
import { ArtworkPlaceholder } from "@/features/library/metadata/ArtworkPlaceholder";
import { PendingBadge } from "@/features/library/metadata/PendingBadge";
import { CloseButton } from "@/shared/ui/CloseButton";

interface InspectHeaderProps {
  album: Album;
  pending: { fields: number; tracks: number };
  /** `undefined` hides the button: the album has no artist page. */
  artistImage: { url: string | null } | undefined;
  onOpenCover: () => void;
  onOpenArtistImage: () => void;
  onClose: () => void;
}

export function InspectHeader({
  album,
  pending,
  artistImage,
  onOpenCover,
  onOpenArtistImage,
  onClose,
}: InspectHeaderProps) {
  const { t } = useTranslation("library");
  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-separator panel-wash px-5 py-3.5">
      <button
        type="button"
        onClick={onOpenCover}
        aria-label={t("albumMetadata.cover.title")}
        className="group relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-lg outline-none ring-1 ring-artwork-edge focus-visible:ring-2 focus-visible:ring-accent"
      >
        {album.artUrl ? (
          <img src={album.artUrl} alt="" className="size-full object-cover" />
        ) : (
          <ArtworkPlaceholder className="size-full" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-scrim opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ImagePlus className="size-4 text-on-scrim" />
        </span>
      </button>
      {artistImage && (
        <ArtistImageButton imageUrl={artistImage.url} label={t("artists.image.title")} onClick={onOpenArtistImage} />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">
          {t("albumMetadata.eyebrow")}
        </p>
        <h2 className="mt-0.5 truncate text-xl leading-tight font-semibold tracking-tight text-foreground">
          {album.title}
          <span className="ml-2 text-[0.8125rem] font-normal text-muted">
            {t("trackCount", { count: album.tracks.length })}
            {album.year != null && ` · ${album.year}`}
          </span>
        </h2>
      </div>
      <PendingBadge fields={pending.fields} tracks={pending.tracks} />
      <CloseButton label={t("metadata.close")} onPress={onClose} />
    </header>
  );
}
