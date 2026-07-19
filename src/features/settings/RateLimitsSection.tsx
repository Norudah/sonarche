import { useTranslation } from "react-i18next";

import type { Preferences, RateLimitKey } from "@/features/settings/api";
import { DelaySlider } from "@/features/settings/DelaySlider";
import { RATE_LIMITS } from "@/features/settings/rateLimits";

interface RateLimitsSectionProps {
  preferences: Preferences;
  onChangeDelay: (key: RateLimitKey, seconds: number) => void;
}

export function RateLimitsSection({ preferences, onChangeDelay }: RateLimitsSectionProps) {
  const { t } = useTranslation("settings");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold">{t("rateLimits.title")}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">{t("rateLimits.description")}</p>
      </div>

      {RATE_LIMITS.map((def) => (
        <DelaySlider
          key={def.key}
          def={def}
          seconds={preferences[def.field]}
          onCommit={(seconds) => onChangeDelay(def.key, seconds)}
        />
      ))}
    </div>
  );
}
