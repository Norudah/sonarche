import { RadioGroup } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { LanguageChoice } from "@/features/settings/LanguageChoice";
import { SettingCard } from "@/features/settings/SettingCard";
import { SettingsHero } from "@/features/settings/SettingsHero";
import { ThemeTile } from "@/features/settings/ThemeTile";
import { useTheme } from "@/features/settings/ThemeContext";
import { THEME_PREFERENCES, type ThemePreference } from "@/features/settings/theme";

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
  const { preference, resolved, choose } = useTheme();

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

          {/* Only under `system`: with an explicit choice the tile already
              says which theme is on, and repeating it would be noise. */}
          {preference === "system" && (
            <p className="text-[0.75rem] text-muted">
              {t(resolved === "dark" ? "appearance.theme.followingDark" : "appearance.theme.followingLight")}
            </p>
          )}
        </Setting>
      </SettingCard>

      <SettingCard>
        <Setting name={t("appearance.language.name")} why={t("appearance.language.why")}>
          <LanguageChoice label={t("appearance.language.name")} />
        </Setting>
      </SettingCard>
    </>
  );
}
