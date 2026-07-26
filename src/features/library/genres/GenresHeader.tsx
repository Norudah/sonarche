import { useTranslation } from "react-i18next";

interface GenresHeaderProps {
  familyCount: number;
  genreCount: number;
  unclassifiedCount: number;
}

/**
 * Identity and size, like the album and artist headers — the controls are in
 * the bar below.
 *
 * No scope toggle there, since the flat genre list left with the distribution:
 * search is how a specific genre is reached, because a card matches on the
 * genres it holds. No recompute button either: the genre pass is being
 * repurposed as a fallback for when MusicBrainz returns no genre, not a manual
 * action offered here.
 */
export function GenresHeader({ familyCount, genreCount, unclassifiedCount }: GenresHeaderProps) {
  const { t } = useTranslation("library");

  const meta = [
    t("genres.familyCount", { count: familyCount }),
    t("genres.genreCount", { count: genreCount }),
    unclassifiedCount > 0 ? t("genres.unclassifiedCount", { count: unclassifiedCount }) : null,
  ].filter(Boolean);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{t("views.genres")}</h1>
      <p className="mt-0.5 text-[0.8125rem] text-muted">{meta.join(" · ")}</p>
    </div>
  );
}
