import { Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { DelaySlider } from "@/features/settings/DelaySlider";
import { RATE_LIMITS } from "@/features/settings/rateLimits";
import { SettingCard } from "@/features/settings/SettingCard";
import { SettingsHero } from "@/features/settings/SettingsHero";
import { usePreferences, useSetRateLimitDelay } from "@/features/settings/hooks";

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
        RATE_LIMITS.map((def) => (
          <SettingCard key={def.key}>
            <DelaySlider
              def={def}
              seconds={preferences.data![def.field]}
              onCommit={(seconds) => setDelay.mutate({ key: def.key, seconds })}
            />
          </SettingCard>
        ))
      )}

      {setDelay.isError && <p className="text-sm text-danger">{String(setDelay.error)}</p>}
    </>
  );
}
