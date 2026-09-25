import { Switch } from "@heroui/react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { HeroWash } from "@/features/library/HeroWash";
import { ChecksMenu } from "@/features/library/triage/ChecksMenu";
import type { CheckKey } from "@/features/library/triage/enabledChecks";
import type { TriageLine, TriageTally } from "@/features/library/triage/queue";
import { storeNotificationBadges, useNotificationBadges } from "@/shared/lib/notificationBadges";

interface TriageHeroProps {
  /** Null while loading or when there is no library. */
  tally: TriageTally | null;
  /** Including disabled lines, for the menu. */
  queue: TriageLine[];
  disabled: CheckKey[];
  trackCount: number;
  albumCount: number;
  artistCount: number;
}

/** The sidebar badge switch, on the page it's about (same store as Settings). */
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

/** The triage band. The headline counts tracks and albums to complete, each
 * once; the library size is secondary context. */
export function TriageHero({ tally, queue, disabled, trackCount, albumCount, artistCount }: TriageHeroProps) {
  const { t } = useTranslation(["metadata", "library"]);

  return (
    <header className="relative -mx-8 -mt-5 px-8 pt-10 pb-6">
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

        <div className="flex shrink-0 items-center gap-1">
          <ChecksMenu queue={queue} disabled={disabled} />
          <BadgeSwitch />
        </div>
      </div>
    </header>
  );
}

/** One sentence naming only the kinds present ("2 albums to complete", not
 * "0 tracks and 2 albums"). */
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
