import { useTranslation } from "react-i18next";

interface AlbumsHeaderProps {
  albumCount: number;
  trackCount: number;
}

/**
 * Identity and size. Nothing else: search and sort live in the bar below, with
 * the rest of the shelf's controls, so this row is a title rather than half a
 * toolbar.
 *
 * No "play everything" button either, unlike the tracks header: playing 24
 * albums back to back is not an intent anyone has. On a grid the play action
 * belongs to each card, so the primary control lives there.
 */
export function AlbumsHeader({ albumCount, trackCount }: AlbumsHeaderProps) {
  const { t } = useTranslation("library");

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{t("views.albums")}</h1>
      <p className="mt-0.5 text-[0.8125rem] text-muted">
        {t("albumCount", { count: albumCount })} · {t("trackCount", { count: trackCount })}
      </p>
    </div>
  );
}
