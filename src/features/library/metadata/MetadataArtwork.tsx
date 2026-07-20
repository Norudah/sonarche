import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ArtworkPlaceholder } from "@/features/library/metadata/ArtworkPlaceholder";

/** Cover with an edit affordance pinned to its bottom-right corner. The button is
 * inert until artwork replacement ships. */
export function MetadataArtwork({ artUrl }: { artUrl: string | null }) {
  const { t } = useTranslation("library");

  return (
    <div className="relative shrink-0">
      {artUrl ? (
        <img src={artUrl} alt="" className="size-24 rounded-2xl object-cover shadow-lg ring-1 ring-white/20" />
      ) : (
        <ArtworkPlaceholder className="size-24 rounded-2xl shadow-lg ring-1 ring-white/20" />
      )}
      <button
        type="button"
        disabled
        title={t("metadata.comingSoon")}
        aria-label={t("metadata.changeArtwork")}
        className="absolute -right-1.5 -bottom-1.5 flex size-7 cursor-pointer items-center justify-center rounded-full bg-surface text-foreground/70 shadow-md ring-1 ring-black/5"
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}
