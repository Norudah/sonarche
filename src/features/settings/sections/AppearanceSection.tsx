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

/** Theme, language and launch welcome; applied on click. */
export function AppearanceSection() {
  const { t } = useTranslation("settings");
  const { preference, choose } = useTheme();
  // Local state: the shell reads it once at mount.
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
