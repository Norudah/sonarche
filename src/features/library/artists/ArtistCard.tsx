import { Play } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { artistPath } from "@/app/routes";
import { ArtistAvatar } from "@/features/library/artists/ArtistAvatar";
import type { Artist } from "@/features/library/artists/artists";
import { springs } from "@/shared/motion/tokens";

interface ArtistCardProps {
  artist: Artist;
  style?: CSSProperties;
  onPlay: () => void;
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
export function ArtistCard({ artist, style, onPlay }: ArtistCardProps) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");

  return (
    <div style={style} className="group/card cascade-item relative">
      <Link
        to={artistPath(artist.name)}
        // Lets the artist page know it can go *back* rather than pushing a fresh
        // entry, which is what makes the grid's scroll position survive.
        state={{ fromGrid: true }}
        className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <ArtistAvatar
          family={artist.family}
          className="aspect-square w-full shadow-sm ring-1 ring-separator/60 transition-shadow group-hover/card:shadow-lg"
        />
        <p className="mt-2.5 truncate text-center text-sm font-medium">{artist.name}</p>
        <p className="truncate text-center text-[0.8125rem] text-muted">
          {t("albumCount", { count: artist.albums.length })} · {t("trackCount", { count: artist.trackCount })}
        </p>
      </Link>

      {/* Centred over the disc, not in a corner: the avatar is a circle, so a
       * corner-anchored button would float on the empty card background. No
       * completeness badge either — completeness is a property of a release you
       * can go and fix, not of a person. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-square items-center justify-center">
        <motion.button
          type="button"
          onClick={onPlay}
          aria-label={tPlayer("play")}
          initial={false}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.06 }}
          transition={springs.snappy}
          className="pointer-events-auto flex size-12 scale-90 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-foreground opacity-0 shadow-lg shadow-accent/30 outline-none transition-[opacity,scale] group-hover/card:scale-100 group-hover/card:opacity-100 focus-visible:scale-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Play className="size-5 fill-current" />
        </motion.button>
      </div>
    </div>
  );
}
