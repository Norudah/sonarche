import { Disc3, Music } from "lucide-react";

import { Swap } from "@/shared/motion/Swap";
import { springs } from "@/shared/motion/tokens";

interface JobArtworkProps {
  /** Real cover art, once enrich found one. */
  coverUrl: string | null;
  /** 16:9 video thumbnail, cropped square. */
  thumbnail: string | null;
  isAlbum: boolean;
  isSettled: boolean;
  size: "lg" | "sm";
}

const BOX = { lg: "size-16 rounded-xl", sm: "size-11 rounded-lg" } as const;
const GLYPH = { lg: "size-5", sm: "size-4" } as const;

/** Desaturated video thumbnail while the job runs, replaced by the real cover
 * when identification lands. */
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
        // Keyed on the image, so it only swaps when the cover replaces the thumbnail.
        swapKey={src}
        mode="cross"
        animate={{ opacity: 1, scale: [0.92, 1] }}
        transition={springs.bouncy}
        className="block w-full"
      >
        {/* `aspect-square`: the wrapper's height is content-driven. */}
        <img
          src={src}
          alt=""
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
