import { Button } from "@heroui/react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { MetadataArtwork } from "@/features/library/metadata/MetadataArtwork";

function useSubtitle(track: LibraryTrack): string {
  const { t } = useTranslation("library");

  return [track.artist || t("unknownArtist"), track.album].filter(Boolean).join(" — ");
}

export function MetadataHeader({ track, onClose }: { track: LibraryTrack; onClose: () => void }) {
  const { t } = useTranslation("library");
  const subtitle = useSubtitle(track);

  return (
    // items-end: the text block sits on the artwork's baseline rather than
    // floating at its centre. pt > pb on purpose: a centred row inside this
    // band reads as an accident, not a layout.
    <header className="relative flex shrink-0 items-end gap-5 bg-gradient-to-br from-metadata-header-from to-metadata-header-to px-7 pt-12 pb-5 text-white">
      <MetadataArtwork artUrl={track.artUrl} />
      {/* pr-8 keeps the title clear of the absolutely-placed close button. */}
      <div className="min-w-0 flex-1 pr-8">
        <h2 className="truncate text-lg leading-tight font-semibold tracking-tight">
          {track.title || t("unknownTitle")}
        </h2>
        <p className="mt-0 text-[0.78125rem] leading-tight text-white/75">{subtitle}</p>
      </div>
      <Button
        isIconOnly
        variant="tertiary"
        size="sm"
        onPress={onClose}
        aria-label={t("metadata.close")}
        className="absolute top-4 right-4 rounded-full bg-white/15 text-white hover:bg-white/25"
      >
        <X className="size-4" />
      </Button>
    </header>
  );
}
