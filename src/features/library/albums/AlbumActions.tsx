import { Play, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { Album } from "@/features/library/albums/albums";
import { springs } from "@/shared/motion/tokens";

interface AlbumActionsProps {
  album: Album;
  onPlay: () => void;
  onDelete: () => void;
}

/** Same size-12 accent disc as the tracks header: it is the page's one primary
 * action, and the app should have exactly one shape for that. */
export function AlbumActions({ album, onPlay, onDelete }: AlbumActionsProps) {
  const { t } = useTranslation("library");

  return (
    <div className="flex items-center gap-3">
      <motion.button
        type="button"
        onClick={onPlay}
        aria-label={t("playAll")}
        whileTap={{ scale: 0.94 }}
        whileHover={{ scale: 1.05 }}
        transition={springs.snappy}
        className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <Play className="size-5 fill-current" />
      </motion.button>

      <button
        type="button"
        onClick={onDelete}
        aria-label={t("deleteAlbum.action")}
        title={t("deleteAlbum.action")}
        className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted outline-none transition-colors hover:bg-default/70 hover:text-danger focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <Trash2 className="size-4" />
      </button>

      {/* Kept next to the actions rather than pushed right with `ml-auto`: on a
       * wide window that stranded a lone chip at the far edge, where it read as
       * an unrelated control instead of as this album's tags. */}
      {album.genres.length > 0 && (
        <div className="ml-1 flex flex-wrap items-center gap-1.5">
          {album.genres.map((genre) => (
            <span
              key={genre}
              className="rounded-md bg-default/70 px-2 py-0.5 text-[0.6875rem] text-foreground"
            >
              {genre}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
