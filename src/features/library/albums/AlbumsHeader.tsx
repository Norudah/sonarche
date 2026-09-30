import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface AlbumsHeaderProps {
  albumCount: number;
  trackCount: number;
  /** Top right: the layout switch. */
  actions?: ReactNode;
}

/** Title and counts only; controls live in the bar below. */
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
