import { motion } from "motion/react";
import { Link } from "react-router";

import { genrePath } from "@/app/routes";
import { springs } from "@/shared/motion/tokens";

const MotionLink = motion.create(Link);

const CHIP =
  "rounded-full border border-separator bg-surface/70 px-2.5 py-1 text-[0.6875rem] text-foreground outline-none transition-colors hover:border-accent/40 hover:bg-surface hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/40";

/**
 * The genres of whatever the hero is about, under its meta line.
 *
 * They sat in the album's action row until the re-match result needed a place
 * to land: a chip beside four buttons wrapped the whole row the moment any text
 * appeared after it, and the band jumped as you clicked. They are not actions —
 * describing the record is the meta line's job, so they belong on it.
 *
 * Each chip is now also a door: it leads to the genre's own page, scoped inside
 * its family. `families` maps a genre name to that family key (see
 * `genreFamilyIndex`); a genre missing from it falls back to a plain label
 * rather than a link into a page that would bounce straight back out.
 */
export function GenreChips({ genres, families }: { genres: string[]; families?: Map<string, string> }) {
  if (genres.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {genres.map((genre) => {
        const family = families?.get(genre);
        if (!family) {
          return (
            <span key={genre} className={CHIP}>
              {genre}
            </span>
          );
        }
        return (
          <MotionLink
            key={genre}
            to={genrePath(family, genre)}
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.05 }}
            transition={springs.snappy}
            className={CHIP}
          >
            {genre}
          </MotionLink>
        );
      })}
    </div>
  );
}
