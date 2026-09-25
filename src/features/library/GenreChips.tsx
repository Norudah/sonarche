import { motion } from "motion/react";
import { Link } from "react-router";

import { genrePath } from "@/app/routes";
import { springs } from "@/shared/motion/tokens";

const MotionLink = motion.create(Link);

const CHIP =
  "rounded-full border border-separator bg-surface/70 px-2.5 py-1 text-[0.6875rem] text-foreground outline-none transition-colors hover:border-accent/40 hover:bg-surface hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/40";

/** Genre chips on the hero's meta line, each linking to its genre page;
 * genres without a family (see `genreFamilyIndex`) are plain labels. */
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
