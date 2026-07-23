import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { genrePath } from "@/app/routes";
import type { Family } from "@/features/library/genres/genres";
import { toneOf } from "@/features/library/genres/tone";
import { springs } from "@/shared/motion/tokens";

/** Chips beyond this fold into a "+N" chip that opens the family page, where
 * SubGenreChips shows them all. */
const VISIBLE_SUBS = 5;

/** Every affordance on this card is a link, and the app answers a pointer by
 * scaling under a snappy spring — the album and artist cards' play buttons do
 * exactly this. Motion cannot drive a bare <Link>, hence the wrapper. */
const MotionLink = motion.create(Link);

interface FamilyCardProps {
  family: Family;
  label: string;
  style?: CSSProperties;
}

/** Washed in the family tone rather than neutral: the chips are the card's
 * content, so they carry the identity at a lower volume than the rule. */
const chipClass =
  "inline-block rounded-full bg-[color-mix(in_oklab,var(--tone)_9%,transparent)] px-2.5 py-1 text-[0.75rem] " +
  "text-foreground/85 outline-none transition-colors hover:bg-[color-mix(in_oklab,var(--tone)_16%,transparent)] " +
  "focus-visible:ring-2 focus-visible:ring-accent/40";

/**
 * One browse family as a door, not a statistic.
 *
 * The family's identity is carried quietly: a short tone rule to the left of
 * the name — the same device the album drawer uses to head a section — plus
 * chips washed in that tone and a whisper of it behind the whole card. No
 * heavy colour block or full-height border: thirteen of these read as one
 * shelf, not a rainbow.
 *
 * Navigation is two kinds of link, kept apart so neither nests inside the
 * other: the arrow button opens the family page, and each chip deep-links to
 * one genre on that same page via the `genre` query param SubGenreChips
 * already understands. The title is deliberately not a link — one explicit
 * affordance beats a whole header that highlights on hover.
 *
 * The chips push rather than replace — from the index the family page is a new
 * place, unlike the refinement chips on the page itself.
 */
export function FamilyCard({ family, label, style }: FamilyCardProps) {
  const { t } = useTranslation("library");
  const tone = toneOf(family.key);
  const subs = family.subs.slice(0, VISIBLE_SUBS);
  const hiddenCount = family.subs.length - subs.length;

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
            {t("trackCount", { count: family.trackCount })} · {t("albumCount", { count: family.albums.length })} ·{" "}
            {t("artistCount", { count: family.artistCount })}
          </span>
        </span>
        <MotionLink
          to={genrePath(family.key)}
          state={{ fromGenres: true }}
          aria-label={label}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.94 }}
          transition={springs.snappy}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--tone)_12%,transparent)] outline-none transition-colors hover:bg-[color-mix(in_oklab,var(--tone)_22%,transparent)] focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <ArrowRight className="size-4" style={{ color: tone }} />
        </MotionLink>
      </div>

      {subs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pt-0.5 pb-4">
          {subs.map((sub) => (
            <MotionLink
              key={sub.name}
              to={genrePath(family.key, sub.name)}
              state={{ fromGenres: true }}
              whileHover={{ scale: 1.07 }}
              whileTap={{ scale: 0.95 }}
              transition={springs.snappy}
              className={chipClass}
            >
              {sub.name}
              <span className="ml-1.5 tabular-nums opacity-60">{sub.trackCount}</span>
            </MotionLink>
          ))}
          {hiddenCount > 0 && (
            <MotionLink
              to={genrePath(family.key)}
              state={{ fromGenres: true }}
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
