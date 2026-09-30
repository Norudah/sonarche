import { Button, Radio, RadioGroup } from "@heroui/react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { AUDIO_FORMATS, isNativeFormat, parseAudioFormat } from "@/features/settings/audioFormats";
import { SettingCard, SettingCardHeader } from "@/features/settings/SettingCard";
import { useSettingsTasks } from "@/features/settings/tasks";
import { usePreferences, useSetAudioFormat } from "@/features/settings/hooks";
import { layoutIds, springs } from "@/shared/motion/tokens";

/* The app's segmented control (see `KindChoice` for the HeroUI overrides). */
const SEGMENT = "relative mt-0 flex-1 rounded-full";
const SEGMENT_CONTENT =
  "relative w-full justify-center px-3 py-1.5 text-[0.8125rem] font-medium whitespace-nowrap " +
  "transition-colors text-muted hover:text-foreground data-[selected]:text-accent";

/** Audio format: the setting applies to future downloads instantly; converting
 * the existing library is a separate button behind a dialog. */
export function AudioFormatCard() {
  const { t } = useTranslation("settings");
  const preferences = usePreferences();
  const setFormat = useSetAudioFormat();
  const { start } = useSettingsTasks();

  const format = parseAudioFormat(preferences.data?.audioFormat);

  return (
    <SettingCard settingKey="files.audioFormat">
      <div className="flex flex-col gap-3">
        <SettingCardHeader title={t("files.audioFormat.name")} description={t("files.audioFormat.why")} />

        <RadioGroup
          value={format}
          onChange={(next) => setFormat.mutate(parseAudioFormat(next))}
          isDisabled={preferences.isPending || setFormat.isPending}
          aria-label={t("files.audioFormat.name")}
          className="flex w-full flex-row gap-1 rounded-full bg-default/60 p-1"
        >
          {AUDIO_FORMATS.map((option) => (
            <Radio.Root key={option} value={option} className={SEGMENT}>
              {format === option && (
                <motion.span
                  layoutId={layoutIds.audioFormat}
                  transition={springs.snappy}
                  className="absolute inset-0 rounded-full bg-surface shadow-xs"
                />
              )}
              <Radio.Content className={SEGMENT_CONTENT}>{t(`files.audioFormat.formats.${option}.name`)}</Radio.Content>
            </Radio.Root>
          ))}
        </RadioGroup>

        {/* The chosen format's explanation. */}
        <p className="text-[0.8125rem] leading-relaxed text-muted">{t(`files.audioFormat.formats.${format}.why`)}</p>

        {setFormat.isError && <p className="text-[0.8125rem] text-danger">{String(setFormat.error)}</p>}

        <div className="flex flex-col gap-2 border-t border-separator/60 pt-3">
          <p className="text-[0.8125rem] leading-relaxed text-muted">
            {/* Changing the setting doesn't touch existing files. */}
            {isNativeFormat(format)
              ? t("files.audioFormat.convert.pitchNative")
              : t("files.audioFormat.convert.pitch", {
                  format: t(`files.audioFormat.formats.${format}.name`),
                })}
          </p>
          {/* Handed to `SettingsTaskHost` so it survives closing settings (see `tasks.tsx`). */}
          <Button
            variant="secondary"
            className="self-start"
            onPress={() => start({ kind: "convert" })}
            isDisabled={preferences.isPending}
          >
            {t("files.audioFormat.convert.action")}
          </Button>
        </div>
      </div>
    </SettingCard>
  );
}
