import { Pencil } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { ArtworkPlaceholder } from "@/features/library/metadata/ArtworkPlaceholder";
import { springs } from "@/shared/motion/tokens";

/** Cover with an edit affordance pinned to its bottom-right corner. It pops in
 * when the panel opens — the cover is the panel's face, so it lands with a beat
 * rather than being already there. The pencil only shows while the metadata is
 * being edited (it belongs to that mode) and is inert until artwork replacement
 * ships. */
export function MetadataArtwork({ artUrl, isEditing }: { artUrl: string | null; isEditing: boolean }) {
  const { t } = useTranslation("library");

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={springs.bouncy}
      className="relative shrink-0"
    >
      {artUrl ? (
        <img src={artUrl} alt="" className="size-24 rounded-2xl object-cover shadow-lg ring-1 ring-black/5" />
      ) : (
        <ArtworkPlaceholder className="size-24 rounded-2xl shadow-lg ring-1 ring-black/5" />
      )}
      {isEditing && (
        <motion.button
          type="button"
          disabled
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springs.bouncy}
          title={t("metadata.comingSoon")}
          aria-label={t("metadata.changeArtwork")}
          className="absolute -right-1.5 -bottom-1.5 flex size-7 cursor-pointer items-center justify-center rounded-full bg-surface text-foreground/70 shadow-md ring-1 ring-black/5"
        >
          <Pencil className="size-3.5" />
        </motion.button>
      )}
    </motion.div>
  );
}
