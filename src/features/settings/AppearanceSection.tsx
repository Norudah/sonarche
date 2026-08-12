import { RadioGroup, Switch } from "@heroui/react";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { LanguageChoice } from "@/shared/i18n/LanguageChoice";
import { readLaunchWelcome, storeLaunchWelcome } from "@/features/settings/launchWelcome";
import { SettingCard } from "@/features/settings/SettingCard";
import { SettingsHero } from "@/features/settings/SettingsHero";
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

      {/* The one setting here whose answer is yes or no, so the only one whose
          name and control fit on the same line. `Setting` is not reused for
          that reason — it stacks name, reason, control, and stacking a switch
          under its own name puts the label twice on screen. The reason still
          sits at full width underneath, like everywhere else on this page. */}
      <SettingCard>
        <div className="flex flex-col gap-1">
          <Switch isSelected={welcome} onChange={chooseWelcome} className="w-full">
            {/* `flex-row-reverse` on the clickable row, not on the root: the
                control is authored first and belongs on the right, and the
                whole row stays the hit target either way. */}
            <Switch.Content className="w-full flex-row-reverse justify-between">
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <span className="text-[0.8125rem] font-semibold">{t("appearance.launchWelcome.name")}</span>
            </Switch.Content>
          </Switch>
          <p className="text-[0.8125rem] leading-relaxed text-muted">{t("appearance.launchWelcome.why")}</p>
        </div>
      </SettingCard>

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
