import { RadioGroup } from "@heroui/react";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { LanguageChoice } from "@/shared/i18n/LanguageChoice";
import { readLaunchWelcome, storeLaunchWelcome } from "@/features/settings/launchWelcome";
import { SettingCard } from "@/features/settings/SettingCard";
import { SettingsHero } from "@/features/settings/SettingsHero";
import { SwitchCard } from "@/features/settings/SwitchCard";
import { ThemeTile } from "@/features/settings/ThemeTile";
import { useTheme } from "@/features/settings/ThemeContext";
import { THEME_PREFERENCES, type ThemePreference } from "@/features/settings/theme";
import { requestHomeTour } from "@/shared/lib/homeTour";

/** One setting's title and reason, above whatever control it drives. */
function Setting({ name, why, children }: { name: string; why: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-[0.8125rem] font-semibold">{name}</p>
        <p className="text-[0.8125rem] leading-relaxed text-muted">{why}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * How the app presents itself: what it wears and what it speaks. Both apply on
 * the click rather than on a save — the whole point of either control is seeing
 * the answer.
 */
export function AppearanceSection() {
  const { t } = useTranslation("settings");
  const { preference, choose } = useTheme();
  // Local state, no context: the shell read this once at mount and nothing else
  // on screen answers to it. The switch is showing a stored value, not driving
  // anything live.
  const [welcome, setWelcome] = useState(readLaunchWelcome);

  function chooseWelcome(on: boolean) {
    setWelcome(on);
    storeLaunchWelcome(on);
  }

  return (
    <>
      <SettingsHero eyebrow={t("title")} title={t("appearance.title")} description={t("appearance.description")} />

      <SettingCard>
        <Setting name={t("appearance.theme.name")} why={t("appearance.theme.why")}>
          <RadioGroup
            value={preference}
            onChange={(next) => choose(next as ThemePreference)}
            aria-label={t("appearance.theme.name")}
            className="grid w-full grid-cols-3 gap-3"
          >
            {THEME_PREFERENCES.map((option) => (
              <ThemeTile key={option} value={option} selected={preference} label={t(`appearance.theme.${option}`)} />
            ))}
          </RadioGroup>
        </Setting>
      </SettingCard>

      <SettingCard>
        <Setting name={t("appearance.language.name")} why={t("appearance.language.why")}>
          <LanguageChoice label={t("appearance.language.name")} />
        </Setting>
      </SettingCard>

      <SwitchCard
        name={t("appearance.launchWelcome.name")}
        why={t("appearance.launchWelcome.why")}
        isSelected={welcome}
        onChange={chooseWelcome}
      />

      <SettingCard>
        <Setting name={t("appearance.tour.name")} why={t("appearance.tour.why")}>
          <div>
            <button
              type="button"
              onClick={requestHomeTour}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-separator px-3.5 py-1.5 text-[0.8125rem] font-medium text-foreground outline-none transition-colors hover:bg-default/60 focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <RotateCcw className="size-3.5" />
              {t("appearance.tour.replay")}
            </button>
          </div>
        </Setting>
      </SettingCard>
    </>
  );
}
