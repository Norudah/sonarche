import { motion } from "motion/react";

import { ArtworkPlaceholder } from "@/features/library/metadata/ArtworkPlaceholder";
import { springs } from "@/shared/motion/tokens";

/** The panel's face: the cover pops in when it opens, rather than being already
 * there. No edit affordance — artwork replacement does not exist yet, and a
 * disabled pencil under the cursor promised something the app could not do. It
 * comes back the day the feature does. */
export function MetadataArtwork({ artUrl }: { artUrl: string | null }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={springs.bouncy}
      className="relative shrink-0"
    >
      {artUrl ? (
        <img src={artUrl} alt="" className="size-24 rounded-2xl object-cover shadow-lg ring-1 ring-artwork-edge" />
      ) : (
        <ArtworkPlaceholder className="size-24 rounded-2xl shadow-lg ring-1 ring-artwork-edge" />
      )}
    </motion.div>
  );
}
