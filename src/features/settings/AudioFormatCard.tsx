import { Button, Radio, RadioGroup } from "@heroui/react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { AUDIO_FORMATS, isNativeFormat, parseAudioFormat } from "@/features/settings/audioFormats";
import { SettingCard, SettingCardHeader } from "@/features/settings/SettingCard";
import { useSettingsTasks } from "@/features/settings/tasks";
import { usePreferences, useSetAudioFormat } from "@/features/settings/hooks";
import { layoutIds, springs } from "@/shared/motion/tokens";

/* The app's segmented grammar, the same one the language choice, the composer's
 * album/track switch and the import page's grouping already wear: a tray, one
 * pill that slides, the selected label in the accent. `.radio` carries a top
 * margin for HeroUI's stacked layout and `.radio__content` sets its own colour,
 * so both are overridden here — see `KindChoice`, which says it first. */
const SEGMENT = "relative mt-0 flex-1 rounded-full";
const SEGMENT_CONTENT =
  "relative w-full justify-center px-3 py-1.5 text-[0.8125rem] font-medium whitespace-nowrap " +
  "transition-colors text-muted hover:text-foreground data-[selected]:text-accent";

/**
 * Which container the music is actually made of — the only setting in the app
 * that rewrites bytes.
 *
 * One card for two gestures that people read as one question and the app has to
 * keep apart: what the *next* download will be (instant, free, reversible), and
 * what everything already on disk is (hours of CPU, and each original deleted
 * as its replacement lands). The choice sits at the top, the conversion is a
 * button underneath it, and the button never fires without the dialog.
 *
 * It used to be three stacked radio cards, each carrying its own paragraph — a
 * block about as tall as the rest of the pane put together, in a grammar used
 * nowhere else in the app. It is the segmented control now, with the *chosen*
 * format's sentence underneath it: the argument for an option only matters
 * while you are considering that option, and a control that answers as you move
 * along it beats three paragraphs read in advance.
 */
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

        {/* The chosen format's own sentence, in the space the segments freed.
            It is what lets the control be this small: the reason follows the
            choice instead of being printed once per option. */}
        <p className="text-[0.8125rem] leading-relaxed text-muted">{t(`files.audioFormat.formats.${format}.why`)}</p>

        {setFormat.isError && <p className="text-[0.8125rem] text-danger">{String(setFormat.error)}</p>}

        <div className="flex flex-col gap-2 border-t border-separator/60 pt-3">
          <p className="text-[0.8125rem] leading-relaxed text-muted">
            {/* The setting alone changes nothing that is already downloaded —
                said here rather than left for someone to discover by finding
                their old files untouched. */}
            {isNativeFormat(format)
              ? t("files.audioFormat.convert.pitchNative")
              : t("files.audioFormat.convert.pitch", {
                  format: t(`files.audioFormat.formats.${format}.name`),
                })}
          </p>
          {/* Hours of work that must survive this dialog being dismissed, so
              pressing it hands the job to `SettingsTaskHost` and closes
              settings — see `tasks.tsx`. */}
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
