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

/** A category as a door: name, size, link. No genre chips, so it doesn't look
 * like a family card (a category has no sub-level). */
export function CategoryCard({ category, label, style }: CategoryCardProps) {
  const { t } = useTranslation("library");
  const tone = toneOf(category.name);

  return (
    <div
      style={
        {
          ...style,
          "--tone": tone,
          background: "color-mix(in oklab, var(--tone) 7%, transparent)",
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
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--tone)_14%,transparent)] outline-none transition-colors hover:bg-[color-mix(in_oklab,var(--tone)_24%,transparent)] focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <ArrowRight className="size-4" style={{ color: tone }} />
      </MotionLink>
    </div>
  );
}
