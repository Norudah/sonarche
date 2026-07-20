import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { genrePath } from "@/app/routes";
import { DistributionRow } from "@/features/library/genres/DistributionRow";
import type { Genre } from "@/features/library/genres/genres";

interface GenreRowProps {
  genre: Genre;
  /** Its family's colour, not one of its own — see `familyTones`. */
  tone: string;
  peakShare: number;
  /** The family's display name, for the line under the genre. */
  familyLabel: string;
  style?: CSSProperties;
}

/**
 * A genre carries its family on the sub-line, where a family row carries its
 * genres. The two lists are the same page read from either end, so the row that
 * says "Rock: Art Rock · Grunge" has a counterpart that says "Art Rock: Rock".
 */
export function GenreRow({ genre, tone, peakShare, familyLabel, style }: GenreRowProps) {
  const { t } = useTranslation("library");

  return (
    <DistributionRow
      to={genrePath(genre.family, genre.name)}
      label={genre.name}
      sublabel={familyLabel}
      tone={tone}
      fill={peakShare === 0 ? 0 : genre.share / peakShare}
      percent={Math.round(genre.share * 100)}
      style={style}
      trailing={
        <span className="block truncate text-muted">
          {t("trackCount", { count: genre.trackCount })} ·{" "}
          {t("albumCount", { count: genre.albums.length })} ·{" "}
          {t("artistCount", { count: genre.artistCount })}
        </span>
      }
    />
  );
}
