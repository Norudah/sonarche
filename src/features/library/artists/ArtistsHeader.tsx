import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface ArtistsHeaderProps {
  artistCount: number;
  albumCount: number;
  /** Top right of the title row — see `AlbumsHeader`, same slot. */
  actions?: ReactNode;
}

/** Same shape as `AlbumsHeader`, down to the counts line: two shelves that look
 * different at the top read as two unrelated screens. */
export function ArtistsHeader({ artistCount, albumCount, actions }: ArtistsHeaderProps) {
  const { t } = useTranslation("library");

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("views.artists")}</h1>
        <p className="mt-0.5 text-[0.8125rem] text-muted">
          {t("artistCount", { count: artistCount })} · {t("albumCount", { count: albumCount })}
        </p>
      </div>
      {actions}
    </div>
  );
}
