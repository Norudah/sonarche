import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface AlbumsHeaderProps {
  albumCount: number;
  trackCount: number;
  /** Top right of the title row — the layout switch. A slot rather than a prop
   * for the same reason as the heroes' own `actions`: what goes there is a
   * whole control, and the header has no business knowing which. */
  actions?: ReactNode;
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
export function AlbumsHeader({ albumCount, trackCount, actions }: AlbumsHeaderProps) {
  const { t } = useTranslation("library");

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("views.albums")}</h1>
        <p className="mt-0.5 text-[0.8125rem] text-muted">
          {t("albumCount", { count: albumCount })} · {t("trackCount", { count: trackCount })}
        </p>
      </div>
      {actions}
    </div>
  );
}
