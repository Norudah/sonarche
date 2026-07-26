import { Button } from "@heroui/react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Album } from "@/features/library/albums/albums";
import { MetadataArtwork } from "@/features/library/metadata/MetadataArtwork";

/** The album drawer's banner — the same accent-soft wash the track drawer and
 * the library heroes wear, so inspection reads as one surface at both scopes.
 * Subtitle carries the artist and the track count, the two facts that frame
 * everything edited below. */
export function AlbumInspectHeader({
  album,
  isEditing,
  onClose,
}: {
  album: Album;
  isEditing: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("library");
  const subtitle = [album.artist, t("trackCount", { count: album.tracks.length })].filter(Boolean).join(" · ");

  return (
    <header className="relative flex shrink-0 items-end gap-5 border-b border-separator/60 bg-gradient-to-b from-accent-soft/70 via-accent-soft/20 to-transparent px-7 pt-14 pb-6">
      <MetadataArtwork artUrl={album.artUrl} isEditing={isEditing} />
      <div className="min-w-0 flex-1 pr-8">
        <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">
          {t("albumMetadata.eyebrow")}
        </p>
        <h2 className="mt-1 truncate text-xl leading-tight font-semibold tracking-tight text-foreground">
          {album.title}
        </h2>
        <p className="mt-1.5 truncate text-[0.8125rem] leading-tight text-muted">{subtitle}</p>
      </div>
      <Button
        isIconOnly
        variant="tertiary"
        size="sm"
        onPress={onClose}
        aria-label={t("metadata.close")}
        className="absolute top-4 right-4 rounded-full bg-default/60 text-muted transition-colors hover:bg-default hover:text-foreground"
      >
        <X className="size-4" />
      </Button>
    </header>
  );
}
