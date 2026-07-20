import { useTranslation } from "react-i18next";

import { ARTIST_SORTS, type ArtistSort } from "@/features/library/artists/artists";
import { SortSelect } from "@/features/library/SortSelect";
import { SearchField } from "@/features/library/tracks/SearchField";

interface ArtistsHeaderProps {
  artistCount: number;
  albumCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  sort: ArtistSort;
  onSortChange: (value: ArtistSort) => void;
}

/** Same shape as `AlbumsHeader`, down to the counts line: two shelves that look
 * different at the top read as two unrelated screens. */
export function ArtistsHeader({
  artistCount,
  albumCount,
  query,
  onQueryChange,
  sort,
  onSortChange,
}: ArtistsHeaderProps) {
  const { t } = useTranslation("library");

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("views.artists")}</h1>
        <p className="mt-0.5 text-[0.8125rem] text-muted">
          {t("artistCount", { count: artistCount })} · {t("albumCount", { count: albumCount })}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <SearchField value={query} onChange={onQueryChange} />
        <SortSelect
          options={ARTIST_SORTS}
          value={sort}
          onChange={onSortChange}
          labelOf={(option) => t(`artists.sort.${option}`)}
        />
      </div>
    </div>
  );
}
