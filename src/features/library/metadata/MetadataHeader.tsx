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
  /** Edits waiting to be written — stated here so the action bar can hold still. */
  pendingFields: number;
  onClose: () => void;
  /** Opens the album's cover replacement — absent for a singleton. */
  onEditArtwork?: () => void;
  /** The artist's disc, worn on the artwork's corner — absent when the album
   * artist resolves to nobody on the shelf. */
  artistBadge?: React.ReactNode;
}) {
  const { t } = useTranslation("library");
  const subtitle = useSubtitle(track);

  return (
    // The same accent-soft → surface wash the library heroes wear, not the old
    // saturated indigo band with white text: the drawer now speaks the album
    // page's language. `items-end` sits the text block on the artwork's baseline
    // rather than floating it at centre — a centred row inside this band reads as
    // an accident, not a layout. A hairline closes the band so it never bleeds
    // into the fields.
    <header className="relative flex shrink-0 items-end gap-5 border-b border-separator/60 panel-wash px-7 pt-14 pb-6">
      <div className="relative shrink-0">
        <MetadataArtwork artUrl={track.artUrl} editLabel={t("albumMetadata.cover.title")} onEdit={onEditArtwork} />
        {artistBadge && <div className="absolute -right-2 -bottom-1">{artistBadge}</div>}
      </div>
      {/* pr-8 keeps the title clear of the absolutely-placed close button. */}
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
