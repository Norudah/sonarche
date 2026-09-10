import { Button, RadioGroup } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { readLaunchWelcome, storeLaunchWelcome } from "@/features/settings/launchWelcome";
import { SectionHeader } from "@/features/settings/SectionHeader";
import { SettingRow, SettingsPanel, SwitchRow } from "@/features/settings/SettingsPanel";
import { ThemeTile } from "@/features/settings/ThemeTile";
import { useTheme } from "@/features/settings/ThemeContext";
import { THEME_PREFERENCES, type ThemePreference } from "@/features/settings/theme";
import { LanguageChoice } from "@/shared/i18n/LanguageChoice";
import { requestHomeTour } from "@/shared/lib/homeTour";

/**
 * How the app presents itself: what it wears and what it speaks. Everything
 * here applies on the click rather than on a save — the whole point of either
 * control is seeing the answer.
 *
 * One panel, four rows. The theme tiles are the widest control in the app's
 * settings and they still fit beside their own name, which is the test for
 * whether something is a row: they are 3:2 drawings, not a surface of their own.
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
      <SectionHeader title={t("appearance.title")} description={t("appearance.description")} />

      <SettingsPanel>
        <SettingRow settingKey="appearance.theme" align="start">
          <RadioGroup
            value={preference}
            onChange={(next) => choose(next as ThemePreference)}
            aria-label={t("appearance.theme.name")}
            className="grid w-80 grid-cols-3 gap-2.5"
          >
            {THEME_PREFERENCES.map((option) => (
              <ThemeTile key={option} value={option} selected={preference} label={t(`appearance.theme.${option}`)} />
            ))}
          </RadioGroup>
        </SettingRow>

        <SettingRow settingKey="appearance.language">
          <div className="w-56">
            <LanguageChoice label={t("appearance.language.name")} />
          </div>
        </SettingRow>

        <SwitchRow settingKey="appearance.launchWelcome" isSelected={welcome} onChange={chooseWelcome} />

        <SettingRow settingKey="appearance.tour">
          <Button variant="secondary" onPress={requestHomeTour}>
            {t("appearance.tour.replay")}
          </Button>
        </SettingRow>
      </SettingsPanel>
    </>
  );
}
