import { Switch } from "@heroui/react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { HeroWash } from "@/features/library/HeroWash";
import type { TriageTally } from "@/features/library/triage/queue";
import { storeNotificationBadges, useNotificationBadges } from "@/shared/lib/notificationBadges";

interface TriageHeroProps {
  /** Null while the library is still loading, or when there is none. */
  tally: TriageTally | null;
  trackCount: number;
  albumCount: number;
  artistCount: number;
}

/**
 * The badge switch, at the top right of the page the badge is about.
 *
 * It already existed in Settings, and that was the wrong place for it: the
 * annoyance is felt here, on the page the number sends you to, and a preference
 * you have to go hunting for is one you resent instead of turning off. Same
 * store as the settings card — one `useSyncExternalStore`, so flipping it here
 * drops the sidebar badge on the spot and the settings page already agrees.
 */
function BadgeSwitch() {
  const { t } = useTranslation("metadata");
  const badges = useNotificationBadges();

  return (
    <Switch size="sm" isSelected={badges} onChange={storeNotificationBadges} className="shrink-0">
      <Switch.Content className="flex-row-reverse gap-2">
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <span className="text-[0.8125rem] text-muted">{t("badgeSwitch")}</span>
      </Switch.Content>
    </Switch>
  );
}

/**
 * The triage post's band.
 *
 * `pt-10`, like the download and import bands and unlike the library heroes'
 * `pt-5`. Two reasons, and either alone would do it. Metadata sits in the
 * sidebar's Explorer section with those two, so it should open on the same air.
 * And `WindowDragStrip` owns the top 2rem of every page: a control starting at
 * 1.25rem is *under* the drag band, which swallows the press — the switch below
 * simply did not respond until this padding pushed it clear.
 *
 * The verdict *is* the headline — but it names what it counts. "64 choses à
 * corriger" was two lies in one line: the lines were summed, so a track missing
 * both a year and a genre was owned twice, and *corriger* framed a missing tag
 * as a mistake the user had made. It now says how many tracks and how many
 * albums Sonarche could still complete, each counted once, and offers rather
 * than scolds. The library's own size stays on the quiet line underneath: it is
 * context, not the message.
 */
export function TriageHero({ tally, trackCount, albumCount, artistCount }: TriageHeroProps) {
  const { t } = useTranslation(["metadata", "library"]);

  return (
    <header className="relative -mx-8 -mt-8 px-8 pt-10 pb-6">
      <HeroWash />

      <div className="relative flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">{t("eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{headlineOf(tally, t)}</h1>
          {tally != null && (
            <p className="mt-1.5 text-[0.8125rem] text-muted">
              {t("library:trackCount", { count: trackCount })} · {t("library:albumCount", { count: albumCount })} ·{" "}
              {t("library:artistCount", { count: artistCount })}
            </p>
          )}
        </div>

        <BadgeSwitch />
      </div>
    </header>
  );
}

/**
 * Both kinds in one sentence when both are present, and a single sentence when
 * only one is — "2 albums à compléter" beats "0 titre et 2 albums", which reads
 * as a scoreboard. The two counts are borrowed from the library namespace so a
 * track is named the same word here as everywhere else in the app.
 */
function headlineOf(tally: TriageTally | null, t: TFunction<["metadata", "library"]>): string {
  if (tally == null) return t("title");
  if (tally.total === 0) return t("allClear");
  if (tally.tracks > 0 && tally.albums > 0)
    return t("toFill.both", {
      tracks: t("library:trackCount", { count: tally.tracks }),
      albums: t("library:albumCount", { count: tally.albums }),
    });
  return tally.tracks > 0 ? t("toFill.tracks", { count: tally.tracks }) : t("toFill.albums", { count: tally.albums });
}
