import { Radio, RadioGroup } from "@heroui/react";
import { Monitor, Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { SettingCard } from "@/features/settings/SettingCard";
import { SettingsHero } from "@/features/settings/SettingsHero";
import {
  applyTheme,
  readStoredPreference,
  resolveTheme,
  storePreference,
  systemPrefersDark,
  type ThemePreference,
  watchSystemTheme,
} from "@/features/settings/theme";
import { layoutIds, springs } from "@/shared/motion/tokens";

/**
 * The live theme, and the choice behind it.
 *
 * Two pieces of state rather than one: what the user asked for is what the
 * control shows and what gets stored, while what the OS reports only matters
 * when the answer is "system". Keeping them apart means flipping the desktop to
 * dark repaints the app without silently rewriting the user's choice to `dark`.
 */
function useThemePreference() {
  const [preference, setPreference] = useState(readStoredPreference);
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  // The OS is an external system and this is the subscription to it — the one
  // shape an effect is actually for. `watchSystemTheme` returns its own
  // unsubscribe, so the cleanup is the return value.
  useEffect(() => watchSystemTheme(setPrefersDark), []);

  const resolved = resolveTheme(preference, prefersDark);

  // The attribute lives on <html>, outside React's tree, so it is written in an
  // effect rather than during render. Keyed on the resolved theme so both paths
  // in — the user picking, and the OS changing under a `system` choice — land
  // here without the caller having to remember either.
  useEffect(() => applyTheme(resolved), [resolved]);

  function choose(next: ThemePreference) {
    setPreference(next);
    storePreference(next);
  }

  return { preference, resolved, choose };
}

/* Same segmented grammar as the composer's album/track switch and the explorer's
 * view switch: one pill that slides between the options, so the choice reads as
 * a switch being thrown rather than three buttons lighting up in turn. Wider
 * segments than those, because these carry a word each rather than living
 * inline in a toolbar — but the same round shape, which is what makes the three
 * read as one control type. Segmented selectors are their own family: they pick
 * rather than act, so the pill/rectangle rule does not apply to them. */
const SEGMENT = "relative mt-0 flex-1 rounded-full";
const SEGMENT_CONTENT =
  "relative w-full justify-center gap-2 px-3 py-2 text-[0.8125rem] font-medium whitespace-nowrap " +
  "transition-colors text-muted hover:text-foreground data-[selected]:text-accent";

function Segment({
  value,
  selected,
  icon: Icon,
  label,
}: {
  value: ThemePreference;
  selected: ThemePreference;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Radio.Root value={value} className={SEGMENT}>
      {selected === value && (
        <motion.span
          layoutId={layoutIds.themeChoice}
          transition={springs.snappy}
          className="absolute inset-0 rounded-full bg-surface shadow-xs"
        />
      )}
      <Radio.Content className={SEGMENT_CONTENT}>
        <Icon className="size-4 shrink-0" />
        {label}
      </Radio.Content>
    </Radio.Root>
  );
}

/**
 * Appearance. One setting for now, and it applies on the click rather than on a
 * save: the whole point of the control is seeing the answer.
 */
export function AppearanceSection() {
  const { t } = useTranslation("settings");
  const { preference, resolved, choose } = useThemePreference();

  return (
    <>
      <SettingsHero eyebrow={t("title")} title={t("appearance.title")} description={t("appearance.description")} />

      <SettingCard>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-[0.8125rem] font-semibold">{t("appearance.theme.name")}</p>
            <p className="text-[0.8125rem] leading-relaxed text-muted">{t("appearance.theme.why")}</p>
          </div>

          <RadioGroup
            value={preference}
            onChange={(next) => choose(next as ThemePreference)}
            aria-label={t("appearance.theme.name")}
            className="flex w-full flex-row gap-1 rounded-full bg-default/60 p-1"
          >
            <Segment value="light" selected={preference} icon={Sun} label={t("appearance.theme.light")} />
            <Segment value="dark" selected={preference} icon={Moon} label={t("appearance.theme.dark")} />
            <Segment value="system" selected={preference} icon={Monitor} label={t("appearance.theme.system")} />
          </RadioGroup>

          {/* Only under `system`: with an explicit choice the segment already
              says which theme is on, and repeating it would be noise. */}
          {preference === "system" && (
            <p className="text-[0.75rem] text-muted">
              {t(resolved === "dark" ? "appearance.theme.followingDark" : "appearance.theme.followingLight")}
            </p>
          )}
        </div>
      </SettingCard>
    </>
  );
}
