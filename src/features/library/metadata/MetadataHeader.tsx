import { Button } from "@heroui/react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { MetadataArtwork } from "@/features/library/metadata/MetadataArtwork";
import { PendingBadge } from "@/features/library/metadata/PendingBadge";

function useSubtitle(track: LibraryTrack): string {
  const { t } = useTranslation("library");

  return [track.artist || t("unknownArtist"), track.album].filter(Boolean).join(" — ");
}

export function MetadataHeader({
  track,
  pendingFields,
  onClose,
  onEditArtwork,
  artistBadge,
}: {
  track: LibraryTrack;
  /** Shown here so the action bar doesn't shift. */
  pendingFields: number;
  onClose: () => void;
  /** Absent for singletons. */
  onEditArtwork?: () => void;
  /** The artist's disc on the artwork's corner, when the artist is on the shelf. */
  artistBadge?: React.ReactNode;
}) {
  const { t } = useTranslation("library");
  const subtitle = useSubtitle(track);

  return (
    // Same wash as the library heroes; text aligned to the artwork's baseline.
    <header className="relative flex shrink-0 items-end gap-5 border-b border-separator/60 panel-wash px-7 pt-14 pb-6">
      <div className="relative shrink-0">
        <MetadataArtwork artUrl={track.artUrl} editLabel={t("albumMetadata.cover.title")} onEdit={onEditArtwork} />
        {artistBadge && <div className="absolute -right-2 -bottom-1">{artistBadge}</div>}
      </div>
      {/* Clears the absolute close button. */}
      <div className="min-w-0 flex-1 pr-8">
        <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">{t("metadata.eyebrow")}</p>
        <h2 className="mt-1 truncate text-xl leading-tight font-semibold tracking-tight text-foreground">
          {track.title || t("unknownTitle")}
        </h2>
        <p className="mt-1.5 truncate text-[0.8125rem] leading-tight text-muted">{subtitle}</p>
        <div className="mt-2 flex">
          <PendingBadge fields={pendingFields} />
        </div>
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
