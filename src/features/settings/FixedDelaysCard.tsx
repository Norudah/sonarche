import { useTranslation } from "react-i18next";

import type { Preferences } from "@/features/settings/api";
import { FIXED_API_DELAYS, formatDelay } from "@/features/settings/rateLimits";
import { SettingCard, SettingCardHeader } from "@/features/settings/SettingCard";

/** The enforced AcoustID and Last.fm delays: shared keys, so one user's pace
 * affects everyone. Shown, not adjustable. */
export function FixedDelaysCard({ preferences }: { preferences: Preferences }) {
  const { t, i18n } = useTranslation("settings");
  const locale = i18n.resolvedLanguage ?? "fr";

  return (
    <SettingCard>
      <div className="flex flex-col gap-3">
        <SettingCardHeader title={t("services.fixed.title")} description={t("services.fixed.body")} />

        <ul className="flex flex-col">
          {FIXED_API_DELAYS.map(({ key, field }) => (
            <li
              key={key}
              className="flex items-baseline justify-between gap-3 border-t border-separator/60 py-2 text-[0.8125rem] last:pb-0"
            >
              <div className="min-w-0">
                <span className="font-medium">{t(`services.fixed.${key}.name`)}</span>
                <span className="ml-2 text-muted">{t(`services.fixed.${key}.role`)}</span>
              </div>
              <span className="shrink-0 font-medium text-accent tabular-nums">
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
