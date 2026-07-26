import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { categoryPath } from "@/app/routes";
import type { Category } from "@/features/library/categories/categories";
import { toneOf } from "@/features/library/categories/tone";
import { springs } from "@/shared/motion/tokens";

const MotionLink = motion.create(Link);

interface CategoryCardProps {
  category: Category;
  label: string;
  style?: CSSProperties;
}

/**
 * One category as a door: its name, its size, and the way in.
 *
 * It used to carry chips for the genres the category cuts across, borrowing the
 * family card's whole grammar. That was the mistake — with the same tone rule,
 * the same washed chips and the same arrow, an OST card was indistinguishable
 * from a genre family whose sub-genres you could click, and a category has no
 * sub-level to offer. Losing the chips is what makes the two shelves tell
 * themselves apart: a family card opens onto a tree, a category card onto a set.
 *
 * The tone rule and the wash stay, because the two shelves are still one app.
 * The genres a category spans are on its page, where they are a filter and read
 * as one.
 */
export function CategoryCard({ category, label, style }: CategoryCardProps) {
  const { t } = useTranslation("library");
  const tone = toneOf(category.name);

  return (
    <div
      style={
        {
          ...style,
          "--tone": tone,
          background: "color-mix(in oklab, var(--tone) 4%, transparent)",
        } as CSSProperties
      }
      className="cascade-item flex items-center gap-3 rounded-2xl border border-separator px-5 py-4"
    >
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
        aria-label={label}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.94 }}
        transition={springs.snappy}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--tone)_12%,transparent)] outline-none transition-colors hover:bg-[color-mix(in_oklab,var(--tone)_22%,transparent)] focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <ArrowRight className="size-4" style={{ color: tone }} />
      </MotionLink>
    </div>
  );
}
