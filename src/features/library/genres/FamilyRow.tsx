import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { genrePath, paths } from "@/app/routes";
import { FAMILY_NONE, type Family } from "@/features/library/genres/genres";
import { familyTone } from "@/features/library/genres/tone";
import { springs } from "@/shared/motion/tokens";

interface FamilyRowProps {
  family: Family;
  /** Position in the ramp — see `familyTone`. */
  rank: number;
  rampSize: number;
  /** Largest share on the page. The bars are drawn against this, not against
   * the whole library: with a top family at 38 %, scaling to 100 % would leave
   * every row stuck in its first third and nothing would be comparable. The
   * stacked bar above already carries the absolute proportion — these rows
   * carry the comparison between families. */
  peakShare: number;
  label: string;
  style?: CSSProperties;
}

/**
 * A family as a leaderboard row: name and sub-genres on the left, a bar in the
 * middle, the counts on the right.
 *
 * `trackCount` and `albumCount` are counted on different units — a track is
 * filed under its own genre, an album under the family holding most of its
 * tracks — so the two figures deliberately do not add up. Nothing here tries to
 * reconcile them.
 */
export function FamilyRow({
  family,
  rank,
  rampSize,
  peakShare,
  label,
  style,
}: FamilyRowProps) {
  const { t } = useTranslation("library");

  // The one family that is not a place to browse but a problem to fix, so its
  // row leads where the fixing happens instead of to a shelf of its own.
  const isUnclassified = family.key === FAMILY_NONE;
  const fill = peakShare === 0 ? 0 : family.share / peakShare;

  return (
    <Link
      to={isUnclassified ? paths.metadata : genrePath(family.key)}
      state={{ fromGenres: true }}
      style={style}
      className="cascade-item group/row flex items-center gap-5 rounded-xl px-3 py-2.5 outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <div className="w-44 shrink-0">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="mt-0.5 truncate text-[0.6875rem] text-muted">
          {isUnclassified
            ? t("genres.unclassifiedHint")
            : family.subs
                .slice(0, 3)
                .map((sub) => sub.name)
                .join(" · ")}
        </p>
      </div>

      <div className="h-2 flex-1 overflow-hidden rounded-full bg-default/40">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: fill }}
          transition={springs.soft}
          style={{ background: familyTone(family.key, rank, rampSize) }}
          className="h-full origin-left rounded-full"
        />
      </div>

      <p className="w-12 shrink-0 text-right text-[0.8125rem] tabular-nums text-muted">
        {Math.round(family.share * 100)} %
      </p>

      {isUnclassified ? (
        <p className="flex w-56 shrink-0 items-center justify-end gap-1.5 text-[0.8125rem] font-medium text-warning">
          {t("genres.fixInMetadata")}
          <ArrowRight className="size-3.5 transition-transform group-hover/row:translate-x-0.5" />
        </p>
      ) : (
        <p className="w-56 shrink-0 truncate text-right text-[0.8125rem] text-muted">
          {t("trackCount", { count: family.trackCount })} ·{" "}
          {t("albumCount", { count: family.albums.length })} ·{" "}
          {t("artistCount", { count: family.artistCount })}
        </p>
      )}
    </Link>
  );
}
