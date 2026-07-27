import { Disc3, Music } from "lucide-react";

import { Swap } from "@/shared/motion/Swap";
import { springs } from "@/shared/motion/tokens";

interface JobArtworkProps {
  /** Real cover art, once the enrich step found one. */
  coverUrl: string | null;
  /** The YouTube thumbnail the job was queued with — 16:9, cropped square. */
  thumbnail: string | null;
  isAlbum: boolean;
  /** The job is through: the artwork stops being provisional. */
  isSettled: boolean;
  size: "lg" | "sm";
}

const BOX = { lg: "size-16 rounded-xl", sm: "size-11 rounded-lg" } as const;
const GLYPH = { lg: "size-5", sm: "size-4" } as const;

/**
 * The download's face, and the one place the app's whole point is visible.
 *
 * A job starts as a YouTube thumbnail — a 16:9 frame of a video, usually a face
 * or a wall of title text — and ends as a record with real cover art. That
 * substitution is the work this app does, and until now it happened inside a
 * 32px cell in a table where nobody ever saw it. Here it is staged: the
 * thumbnail sits desaturated while the pipeline runs, and the cover arrives in
 * full colour with a spring, at the moment identification lands.
 */
export function JobArtwork({ coverUrl, thumbnail, isAlbum, isSettled, size }: JobArtworkProps) {
  const src = coverUrl ?? thumbnail;
  const box = `${BOX[size]} shrink-0 overflow-hidden bg-surface-secondary`;

  if (!src) {
    return (
      <div className={`${box} flex items-center justify-center`}>
        {isAlbum ? (
          <Disc3 className={`${GLYPH[size]} text-muted`} />
        ) : (
          <Music className={`${GLYPH[size]} text-muted`} />
        )}
      </div>
    );
  }

  return (
    <div className={box}>
      <Swap
        // Keyed on the image itself: the swap fires when the cover replaces the
        // thumbnail, and stays put through every other event of the job.
        swapKey={src}
        mode="cross"
        animate={{ opacity: 1, scale: [0.92, 1] }}
        transition={springs.bouncy}
        className="block w-full"
      >
        {/* `aspect-square` rather than `size-full`: the swap wrapper's height is
            content-driven, so a percentage height would resolve to nothing. */}
        <img
          src={src}
          alt=""
          // The history is uncapped, so any of these may be off-screen.
          loading="lazy"
          decoding="async"
          className={
            "aspect-square w-full object-cover transition-[filter] duration-300 " +
            (isSettled ? "saturate-100" : "saturate-[0.45] contrast-[0.95]")
          }
        />
      </Swap>
    </div>
  );
}
