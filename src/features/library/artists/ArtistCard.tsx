import { Play } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { artistPath } from "@/app/routes";
import type { Artist } from "@/features/library/artists/artists";
import { ArtistMosaic } from "@/features/library/artists/ArtistMosaic";
import { springs } from "@/shared/motion/tokens";

interface ArtistCardProps {
  artist: Artist;
  style?: CSSProperties;
  onPlay: () => void;
}

/**
 * Same anatomy as `AlbumCard` — square artwork, two lines of text, a play disc
 * that rises on hover — because it sits in the same kind of grid and a second
 * card shape would make the two shelves read as two different apps.
 *
 * The card is a link and the play button is its *sibling*, not its child: a
 * <button> inside an <a> is invalid HTML and swallows the outer activation.
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
        <div className="relative aspect-square overflow-hidden rounded-xl shadow-sm ring-1 ring-separator/60 transition-shadow group-hover/card:shadow-lg">
          <ArtistMosaic artUrls={artist.artUrls} className="size-full" loading="lazy" />
        </div>
        <p className="mt-2.5 truncate text-sm font-medium">{artist.name}</p>
        <p className="truncate text-[0.8125rem] text-muted">
          {t("albumCount", { count: artist.albums.length })} ·{" "}
          {t("trackCount", { count: artist.trackCount })}
        </p>
      </Link>

      {/* No completeness badge, unlike the album card: completeness is a
       * property of a release you can go and fix, not of a person. */}
      <div className="absolute right-2.5 bottom-14 flex translate-y-1 items-center gap-1.5 opacity-0 transition-[opacity,translate] group-hover/card:translate-y-0 group-hover/card:opacity-100 focus-within:translate-y-0 focus-within:opacity-100">
        <motion.button
          type="button"
          onClick={onPlay}
          aria-label={tPlayer("play")}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.06 }}
          transition={springs.snappy}
          className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Play className="size-4 fill-current" />
        </motion.button>
      </div>
    </div>
  );
}
