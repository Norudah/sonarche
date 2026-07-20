import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { genrePath, paths } from "@/app/routes";
import { DistributionRow } from "@/features/library/genres/DistributionRow";
import { FAMILY_NONE, type Family } from "@/features/library/genres/genres";

interface FamilyRowProps {
  family: Family;
  tone: string;
  peakShare: number;
  label: string;
  style?: CSSProperties;
}

/**
 * `trackCount` and `albums.length` are counted on different units — a track is
 * filed under its own genre, an album under the family holding most of its
 * tracks — so the two figures deliberately do not add up. Nothing here tries to
 * reconcile them.
 */
export function FamilyRow({ family, tone, peakShare, label, style }: FamilyRowProps) {
  const { t } = useTranslation("library");

  // The one family that is not a place to browse but a problem to fix, so its
  // row leads where the fixing happens instead of to a shelf of its own.
  const isUnclassified = family.key === FAMILY_NONE;

  return (
    <DistributionRow
      to={isUnclassified ? paths.metadata : genrePath(family.key)}
      label={label}
      sublabel={
        isUnclassified
          ? t("genres.unclassifiedHint")
          : family.subs
              .slice(0, 3)
              .map((sub) => sub.name)
              .join(" · ")
      }
      tone={tone}
      fill={peakShare === 0 ? 0 : family.share / peakShare}
      percent={Math.round(family.share * 100)}
      style={style}
      trailing={
        isUnclassified ? (
          <span className="flex items-center justify-end gap-1.5 font-medium text-warning">
            {t("genres.fixInMetadata")}
            <ArrowRight className="size-3.5 transition-transform group-hover/row:translate-x-0.5" />
          </span>
        ) : (
          <span className="block truncate text-muted">
            {t("trackCount", { count: family.trackCount })} · {t("albumCount", { count: family.albums.length })} ·{" "}
            {t("artistCount", { count: family.artistCount })}
          </span>
        )
      }
    />
  );
}
