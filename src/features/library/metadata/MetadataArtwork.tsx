import { ImagePlus } from "lucide-react";
import { motion } from "motion/react";

import { ArtworkPlaceholder } from "@/features/library/metadata/ArtworkPlaceholder";
import { springs } from "@/shared/motion/tokens";

/** The panel's face: the cover pops in when it opens, rather than being already
 * there. With `onEdit` it is also the way to the cover — hover says so, same
 * grammar as the album panel's header. Without it (a singleton with no album
 * row to write to) it stays a plain picture rather than a dead control. */
export function MetadataArtwork({
  artUrl,
  editLabel,
  onEdit,
}: {
  artUrl: string | null;
  /** Accessible name for the edit affordance — required when `onEdit` is set. */
  editLabel?: string;
  onEdit?: () => void;
}) {
  const picture = artUrl ? (
    <img src={artUrl} alt="" className="size-24 rounded-2xl object-cover shadow-lg ring-1 ring-artwork-edge" />
  ) : (
    <ArtworkPlaceholder className="size-24 rounded-2xl shadow-lg ring-1 ring-artwork-edge" />
  );

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={springs.bouncy}
      className="relative shrink-0"
    >
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          className="group relative block cursor-pointer overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {picture}
          <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <ImagePlus className="size-5 text-white" />
          </span>
        </button>
      ) : (
        picture
      )}
    </motion.div>
  );
}
