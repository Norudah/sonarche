import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { categoryPath } from "@/app/routes";
import type { Category } from "@/features/library/categories/categories";
import { toneOf } from "@/features/library/categories/tone";
import { springs } from "@/shared/motion/tokens";

/** Chips beyond this fold into a "+N" chip that opens the category page,
 * where the chip row shows them all. */
const VISIBLE_GENRES = 5;

const MotionLink = motion.create(Link);

interface CategoryCardProps {
  category: Category;
  label: string;
  style?: CSSProperties;
}

const chipClass =
  "inline-block rounded-full bg-[color-mix(in_oklab,var(--tone)_9%,transparent)] px-2.5 py-1 text-[0.75rem] " +
  "text-foreground/85 outline-none transition-colors hover:bg-[color-mix(in_oklab,var(--tone)_16%,transparent)] " +
  "focus-visible:ring-2 focus-visible:ring-accent/40";

/**
 * One category as a door, sharing the family card's whole grammar — tone rule,
 * washed chips, the arrow as the sole card affordance — so Genres and
 * Categories read as two shelves of one app. The difference is what the chips
 * are: here they are the *genres* the category cuts across, which is the very
 * reason the axis exists (an OST shelf holds synthwave next to orchestral),
 * and each deep-links to that genre inside the category.
 */
export function CategoryCard({ category, label, style }: CategoryCardProps) {
  const { t } = useTranslation("library");
  const tone = toneOf(category.name);
  const genres = category.genres.slice(0, VISIBLE_GENRES);
  const hiddenCount = category.genres.length - genres.length;

  return (
    <div
      style={
        {
          ...style,
          "--tone": tone,
          background: "color-mix(in oklab, var(--tone) 4%, transparent)",
        } as CSSProperties
      }
      className="cascade-item flex flex-col rounded-2xl border border-separator"
    >
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <span aria-hidden className="h-9 w-1 shrink-0 rounded-full" style={{ background: tone }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold">{label}</span>
          <span className="mt-0.5 block truncate text-[0.6875rem] text-muted">
            {t("trackCount", { count: category.trackCount })} · {t("albumCount", { count: category.albums.length })} ·{" "}
            {t("artistCount", { count: category.artistCount })}
          </span>
        </span>
        <MotionLink
          to={categoryPath(category.name)}
          state={{ fromCategories: true }}
          aria-label={label}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.94 }}
          transition={springs.snappy}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--tone)_12%,transparent)] outline-none transition-colors hover:bg-[color-mix(in_oklab,var(--tone)_22%,transparent)] focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <ArrowRight className="size-4" style={{ color: tone }} />
        </MotionLink>
      </div>

      {genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pt-0.5 pb-4">
          {genres.map((genre) => (
            <MotionLink
              key={genre.name}
              to={categoryPath(category.name, genre.name)}
              state={{ fromCategories: true }}
              whileHover={{ scale: 1.07 }}
              whileTap={{ scale: 0.95 }}
              transition={springs.snappy}
              className={chipClass}
            >
              {genre.name}
              <span className="ml-1.5 tabular-nums opacity-60">{genre.trackCount}</span>
            </MotionLink>
          ))}
          {hiddenCount > 0 && (
            <MotionLink
              to={categoryPath(category.name)}
              state={{ fromCategories: true }}
              whileHover={{ scale: 1.07 }}
              whileTap={{ scale: 0.95 }}
              transition={springs.snappy}
              className={chipClass}
            >
              {t("genres.moreSubs", { count: hiddenCount })}
            </MotionLink>
          )}
        </div>
      )}
    </div>
  );
}
