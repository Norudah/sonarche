import { useTranslation } from "react-i18next";

import { ALBUM_SORTS, type AlbumSort } from "@/features/library/albums/albums";
import { SortSelect } from "@/features/library/SortSelect";
import { SearchField } from "@/features/library/tracks/SearchField";

interface AlbumsHeaderProps {
  albumCount: number;
  trackCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  sort: AlbumSort;
  onSortChange: (value: AlbumSort) => void;
}

/**
 * No "play everything" button, unlike the tracks header: playing 24 albums
 * back to back is not an intent anyone has. On a grid the play action belongs
 * to each card, so the primary control lives there.
 */
export function AlbumsHeader({
  albumCount,
  trackCount,
  query,
  onQueryChange,
  sort,
  onSortChange,
}: AlbumsHeaderProps) {
  const { t } = useTranslation("library");

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("views.albums")}</h1>
        <p className="mt-0.5 text-[0.8125rem] text-muted">
          {t("albumCount", { count: albumCount })} · {t("trackCount", { count: trackCount })}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <SearchField value={query} onChange={onQueryChange} />
        <SortSelect
          options={ALBUM_SORTS}
          value={sort}
          onChange={onSortChange}
          labelOf={(option) => t(`albums.sort.${option}`)}
        />
      </div>
    </div>
  );
}
