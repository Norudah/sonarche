import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Preferences } from "@/features/settings/api";
import { FIXED_API_DELAYS, formatDelay } from "@/features/settings/rateLimits";
import { SettingCard } from "@/features/settings/SettingCard";

/**
 * The pauses the app imposes rather than offers. AcoustID and Last.fm are
 * reached through keys every install shares, so their pace is not a personal
 * preference — one rushed user gets the key throttled for everyone. The card
 * states the enforced delay instead of handing over a dial.
 *
 * Filed with the services it protects, not with the download pause it used to
 * share a page with: that one is a choice about your own bandwidth, these are
 * a rule about someone else's.
 */
export function FixedDelaysCard({ preferences }: { preferences: Preferences }) {
  const { t, i18n } = useTranslation("settings");
  const locale = i18n.resolvedLanguage ?? "fr";

  return (
    <SettingCard>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{t("services.fixed.title")}</h3>
          <Lock className="size-3.5 text-muted" aria-hidden />
        </div>
        <p className="text-sm text-muted">{t("services.fixed.body")}</p>

        <ul className="flex flex-col">
          {FIXED_API_DELAYS.map(({ key, field }) => (
            <li
              key={key}
              className="flex items-baseline justify-between gap-3 border-t border-separator/60 py-2.5 last:pb-0"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium">{t(`services.fixed.${key}.name`)}</span>
                <span className="ml-2 text-sm text-muted">{t(`services.fixed.${key}.role`)}</span>
              </div>
              <span className="shrink-0 text-sm font-medium text-accent tabular-nums">
                {t("services.fixed.perRequest", {
                  delay: formatDelay(preferences[field], locale, t("instant")),
                })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </SettingCard>
  );
}
