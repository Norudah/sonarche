import { Spinner } from "@heroui/react";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { DelaySlider } from "@/features/settings/DelaySlider";
import { FIXED_API_DELAYS, RATE_LIMITS, formatDelay } from "@/features/settings/rateLimits";
import { SettingCard } from "@/features/settings/SettingCard";
import { SettingsHero } from "@/features/settings/SettingsHero";
import { usePreferences, useSetRateLimitDelay } from "@/features/settings/hooks";
import type { Preferences } from "@/features/settings/api";

/**
 * The pauses the app imposes rather than offers. AcoustID and Last.fm are
 * reached through keys every install shares, so their pace is not a personal
 * preference — one rushed user gets the key throttled for everyone. The card
 * states the enforced delay instead of handing over a dial.
 */
function FixedDelaysCard({ preferences }: { preferences: Preferences }) {
  const { t, i18n } = useTranslation("settings");
  const locale = i18n.resolvedLanguage ?? "fr";

  return (
    <SettingCard>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{t("rateLimits.fixed.title")}</h3>
          <Lock className="size-3.5 text-muted" aria-hidden />
        </div>
        <p className="text-sm text-muted">{t("rateLimits.fixed.body")}</p>

        <ul className="flex flex-col">
          {FIXED_API_DELAYS.map(({ key, field }) => (
            <li
              key={key}
              className="flex items-baseline justify-between gap-3 border-t border-separator/60 py-2.5 last:pb-0"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium">{t(`rateLimits.fixed.${key}.name`)}</span>
                <span className="ml-2 text-sm text-muted">{t(`rateLimits.fixed.${key}.role`)}</span>
              </div>
              <span className="shrink-0 text-sm font-medium text-accent tabular-nums">
                {t("rateLimits.fixed.perRequest", {
                  delay: formatDelay(preferences[field], locale, t("rateLimits.instant")),
                })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </SettingCard>
  );
}

/** Delays auto-save on slider release, so this category has no footer — the
 * commit happens on `onChangeEnd`. */
export function RateLimitsSection() {
  const { t } = useTranslation("settings");
  const preferences = usePreferences();
  const setDelay = useSetRateLimitDelay();

  return (
    <>
      <SettingsHero eyebrow={t("title")} title={t("rateLimits.title")} description={t("rateLimits.description")} />

      {preferences.isPending ? (
        <Spinner size="sm" aria-label={t("loading")} />
      ) : (
        <>
          {RATE_LIMITS.map((def) => (
            <SettingCard key={def.key}>
              <DelaySlider
                def={def}
                seconds={preferences.data![def.field]}
                onCommit={(seconds) => setDelay.mutate({ key: def.key, seconds })}
              />
            </SettingCard>
          ))}
          <FixedDelaysCard preferences={preferences.data!} />
        </>
      )}

      {setDelay.isError && <p className="text-sm text-danger">{String(setDelay.error)}</p>}
    </>
  );
}
