import { useTranslation } from "react-i18next";

import { HeroWash } from "@/features/library/HeroWash";

interface TriageHeroProps {
  /** Null while the library is still loading, or when there is none. */
  toFix: number | null;
  trackCount: number;
  albumCount: number;
  artistCount: number;
}

/**
 * The triage post's band.
 *
 * This page was the last one in the app still opening on a bare `<h1>` on the
 * page ground, with its headline count exiled to an amber pill floating at the
 * far right — the one number the page exists to deliver, parked as far from the
 * title as the row allowed.
 *
 * So the verdict *is* the headline: "26 choses à corriger", or "Rien à
 * corriger" when there is nothing. The eyebrow carries the section name, the
 * way the album and download heroes do, and the library's own size drops to the
 * quiet line underneath where it belongs — it is context, not the message.
 *
 * The pill's other job was scrolling down to the queue. The queue now starts
 * directly under this band, so there is nothing left to scroll to.
 */
export function TriageHero({ toFix, trackCount, albumCount, artistCount }: TriageHeroProps) {
  const { t } = useTranslation(["metadata", "library"]);

  const headline = toFix == null ? t("title") : toFix > 0 ? t("toFix", { count: toFix }) : t("allClear");

  return (
    <header className="relative -mx-8 -mt-8 -mb-2 px-8 pt-5 pb-7">
      <HeroWash />

      <div className="relative">
        <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{headline}</h1>
        {toFix != null && (
          <p className="mt-1.5 text-[0.8125rem] text-muted">
            {t("library:trackCount", { count: trackCount })} · {t("library:albumCount", { count: albumCount })} ·{" "}
            {t("library:artistCount", { count: artistCount })}
          </p>
        )}
      </div>
    </header>
  );
}
