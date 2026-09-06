import { Button, Radio, RadioGroup } from "@heroui/react";
import { FileAudio2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AUDIO_FORMATS, isNativeFormat, parseAudioFormat, type AudioFormat } from "@/features/settings/audioFormats";
import { SettingCard } from "@/features/settings/SettingCard";
import { useSettingsTasks } from "@/features/settings/tasks";
import { usePreferences, useSetAudioFormat } from "@/features/settings/hooks";

/* `data-selected` lands on the Content, not the Root — same as the composer's
 * segmented controls, which is why the chrome lives here rather than one level
 * up. */
const OPTION =
  "flex w-full cursor-pointer items-start gap-3 rounded-xl border border-separator/60 p-3 text-left " +
  "transition-colors hover:border-separator data-[selected]:border-accent data-[selected]:bg-accent-soft/40";

function FormatOption({ format }: { format: AudioFormat }) {
  const { t } = useTranslation("settings");

  return (
    <Radio.Root value={format} className="w-full">
      <Radio.Content className={OPTION}>
        <Radio.Control className="mt-0.5 shrink-0">
          <Radio.Indicator />
        </Radio.Control>
        <span className="min-w-0">
          <span className="block text-[0.8125rem] font-semibold">{t(`files.audioFormat.formats.${format}.name`)}</span>
          <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-muted">
            {t(`files.audioFormat.formats.${format}.why`)}
          </span>
        </span>
      </Radio.Content>
    </Radio.Root>
  );
}

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
 * Not a `<select>`: three options each need a sentence saying why you would
 * pick them — "MP3" alone tells someone nothing about what it costs — and a
 * dropdown is where sentences go to be hidden.
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
        <div className="flex items-center gap-2">
          <FileAudio2 className="size-3.5 text-muted" aria-hidden />
          <h3 className="text-[0.8125rem] font-semibold">{t("files.audioFormat.name")}</h3>
        </div>
        <p className="text-[0.8125rem] leading-relaxed text-muted">{t("files.audioFormat.why")}</p>

        <RadioGroup
          value={format}
          onChange={(next) => setFormat.mutate(parseAudioFormat(next))}
          isDisabled={preferences.isPending || setFormat.isPending}
          aria-label={t("files.audioFormat.name")}
          className="flex flex-col gap-2"
        >
          {AUDIO_FORMATS.map((option) => (
            <FormatOption key={option} format={option} />
          ))}
        </RadioGroup>

        {setFormat.isError && <p className="text-sm text-danger">{String(setFormat.error)}</p>}

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
