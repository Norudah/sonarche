import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { filterAlbums, groupAlbums, sortAlbums, type Album } from "@/features/library/albums/albums";
import { AlbumCover } from "@/features/library/albums/AlbumCover";
import { canonicalAlbumId } from "@/features/library/albums/move";
import { useLibrary } from "@/features/library/hooks";

/** What a picked album resolves to: the beets row a move can land on, plus the
 * words a summary chip can print without going back to the library. */
export interface AlbumTarget {
  albumId: number;
  title: string;
  artist: string;
}

/** Same budget as the move dialog's picker: past this, typing narrows better
 * than scrolling. */
const MAX_ROWS = 30;

const INPUT =
  "rounded-xl border border-separator bg-surface px-3 py-2 text-[0.8125rem] text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/25";

function Row({ album, onPick }: { album: Album; onPick: () => void }) {
  const { t } = useTranslation("library");
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-1.5 text-left outline-none transition-colors hover:bg-default/40 focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <span className="size-9 shrink-0 overflow-hidden rounded-md ring-1 ring-artwork-edge">
        <AlbumCover artUrl={album.artUrl} className="size-full" loading="lazy" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-medium text-foreground">{album.title}</span>
        <span className="block truncate text-[0.75rem] text-muted">
          {album.artist} · {t("trackCount", { count: album.tracks.length })}
        </span>
      </span>
    </button>
  );
}

/**
 * An album of the library, picked inline — the embeddable half of what the
 * move dialog's picker does behind a modal. Search over the shelf, a capped
 * list, and once a record is chosen the list folds away behind it: the
 * component's value is the choice, not the browsing.
 *
 * Groups made only of singletons are not offered: they have no beets row for
 * anything to land on.
 */
export function AlbumSelect({
  value,
  onChange,
}: {
  value: AlbumTarget | null;
  onChange: (next: AlbumTarget | null) => void;
}) {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const [query, setQuery] = useState("");

  const albums = useMemo(() => {
    const cards = groupAlbums(library.data ?? []).filter((album) => album.albumIds.length > 0);
    return sortAlbums(filterAlbums(cards, query), "artist");
  }, [library.data, query]);
  const overflow = Math.max(0, albums.length - MAX_ROWS);

  const pick = (album: Album) => {
    const albumId = canonicalAlbumId(album);
    if (albumId == null) return;
    onChange({ albumId, title: album.title, artist: album.artist });
  };

  if (value) {
    return (
      <div className="flex w-full max-w-96 items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft/40 px-2.5 py-1.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8125rem] font-medium text-foreground">{value.title}</span>
          <span className="block truncate text-[0.75rem] text-muted">{value.artist}</span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t("albumSelect.clear")}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted outline-none transition-colors hover:bg-default/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="relative max-w-96">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted/70" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("move.searchPlaceholder")}
          className={`${INPUT} w-full pl-8`}
        />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-xl border border-separator/60 bg-surface p-1">
        {albums.length === 0 ? (
          <p className="px-2.5 py-3 text-center text-[0.8125rem] text-muted">{t("move.pickerEmpty")}</p>
        ) : (
          <>
            {albums.slice(0, MAX_ROWS).map((album) => (
              <Row key={album.key} album={album} onPick={() => pick(album)} />
            ))}
            {overflow > 0 && (
              <p className="px-2.5 pt-1.5 pb-1 text-center text-[0.75rem] text-muted">
                {t("move.moreResults", { count: overflow })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
