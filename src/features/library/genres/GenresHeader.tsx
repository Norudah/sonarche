import { useTranslation } from "react-i18next";

import { SearchField } from "@/features/library/tracks/SearchField";

interface GenresHeaderProps {
  familyCount: number;
  genreCount: number;
  unclassifiedCount: number;
  query: string;
  onQueryChange: (value: string) => void;
}

/**
 * No sort control, unlike the album and artist shelves. Cards are ordered by
 * size and that ordering *is* the page. No scope toggle either, since the
 * flat genre list left with the distribution: the search field is how a
 * specific genre is reached, because a card matches on the genres it holds.
 * No recompute button: the genre pass is being repurposed as a fallback for
 * when MusicBrainz returns no genre, not a manual action offered here.
 */
export function GenresHeader({ familyCount, genreCount, unclassifiedCount, query, onQueryChange }: GenresHeaderProps) {
  const { t } = useTranslation("library");

  const meta = [
    t("genres.familyCount", { count: familyCount }),
    t("genres.genreCount", { count: genreCount }),
    unclassifiedCount > 0 ? t("genres.unclassifiedCount", { count: unclassifiedCount }) : null,
  ].filter(Boolean);

  return (
    // `items-center` and the controls' own row, exactly like the album and
    // artist headers — a shelf that aligns its search field differently reads as
    // a different screen.
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("views.genres")}</h1>
        <p className="mt-0.5 text-[0.8125rem] text-muted">{meta.join(" · ")}</p>
      </div>

      <SearchField value={query} onChange={onQueryChange} />
    </div>
  );
}
