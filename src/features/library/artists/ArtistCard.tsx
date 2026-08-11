import { ImagePlus, Play } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { artistPath } from "@/app/routes";
import { ArtistAvatar } from "@/features/library/artists/ArtistAvatar";
import type { Artist } from "@/features/library/artists/artists";
import { useArtistImages } from "@/features/library/hooks";
import { springs } from "@/shared/motion/tokens";

interface ArtistCardProps {
  artist: Artist;
  style?: CSSProperties;
  onPlay: () => void;
  /** Opens the artist-image modal — the grid hosts one for all its cards. */
  onEditImage: () => void;
}

/**
 * The album card's sibling in the same grid, but deliberately not its twin: a
 * circular monogram, not a square cover, and centred text under it. The square
 * ↔ circle split is what keeps browsing artists from reading as browsing albums
 * a second time.
 *
 * The play button overlays the disc's centre rather than sitting in a corner as
 * on the album card — a circle has no corner to anchor to. It is the link's
 * *sibling*, not its child: a <button> inside an <a> is invalid HTML and
 * swallows the outer activation.
 */
export function ArtistCard({ artist, style, onPlay, onEditImage }: ArtistCardProps) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");
  // Looked up here rather than plumbed through every grid: the map is one
  // cached query, shared by all cards.
  const imageUrl = useArtistImages().data?.get(artist.name) ?? null;

  return (
    <div style={style} className="group/card cascade-item relative">
      <Link
        to={artistPath(artist.name)}
        // Lets the artist page know it can go *back* rather than pushing a fresh
        // entry, which is what makes the grid's scroll position survive.
        className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <ArtistAvatar
          imageUrl={imageUrl}
          className="aspect-square w-full shadow-sm ring-1 ring-separator/60 transition-shadow group-hover/card:shadow-lg"
        />
        <p className="mt-2.5 truncate text-center text-sm font-medium">{artist.name}</p>
        <p className="truncate text-center text-[0.8125rem] text-muted">
          {t("albumCount", { count: artist.albums.length })} · {t("trackCount", { count: artist.trackCount })}
        </p>
      </Link>

      {/* Bottom-right like the album card, so the two grids share one gesture:
       * the play always waits in the same corner. On a circle that corner sits
       * on the rim, and the button straddling it slightly is deliberate — it
       * reads as pinned to the disc, not floating on the card background. No
       * completeness badge — completeness is a property of a release you can go
       * and fix, not of a person. The image pill beside it is the album card's
       * pencil, translated: dress the disc without leaving the shelf. Each
       * button reveals itself (not the row) so a focus restored by a closing
       * modal cannot pin the pair on screen. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-square items-end justify-end gap-1.5 pr-[5%] pb-[5%]">
        <motion.button
          type="button"
          onClick={onEditImage}
          aria-label={t("artists.image.title")}
          initial={false}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.06 }}
          transition={springs.snappy}
          className="pointer-events-auto flex size-9 scale-90 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white/90 shadow-md opacity-0 backdrop-blur-sm outline-none transition-[opacity,scale,background-color] group-hover/card:scale-100 group-hover/card:opacity-100 hover:bg-black/70 hover:text-white focus-visible:scale-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <ImagePlus className="size-4" />
        </motion.button>

        <motion.button
          type="button"
          onClick={onPlay}
          aria-label={tPlayer("play")}
          initial={false}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.06 }}
          transition={springs.snappy}
          className="pointer-events-auto flex size-11 scale-90 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-foreground opacity-0 glow-accent outline-none transition-[opacity,scale] group-hover/card:scale-100 group-hover/card:opacity-100 focus-visible:scale-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Play className="size-5 fill-current" />
        </motion.button>
      </div>
    </div>
  );
}
