import { Radio, RadioGroup } from "@heroui/react";
import { motion } from "motion/react";

import { LANGUAGES, type Language } from "@/shared/i18n/language";
import { useLanguage } from "@/shared/i18n/useLanguage";
import { layoutIds, springs } from "@/shared/motion/tokens";

/* Segmented control: a language has no picture, and a flag names a country. */
const SEGMENT = "relative mt-0 flex-1 rounded-full";
const SEGMENT_CONTENT =
  "relative w-full justify-center px-3 py-2 text-[0.8125rem] font-medium whitespace-nowrap " +
  "transition-colors text-muted hover:text-foreground data-[selected]:text-accent";

/** Endonyms, so users can find their language whatever the current one. */
const NAMES: Record<Language, string> = { fr: "Français", en: "English" };

export function LanguageChoice({ label }: { label: string }) {
  const { current, choose } = useLanguage();

  return (
    <RadioGroup
      value={current}
      onChange={(next) => choose(next as Language)}
      aria-label={label}
      className="flex w-full flex-row gap-1 rounded-full bg-default/60 p-1"
    >
      {LANGUAGES.map((language) => (
        <Radio.Root key={language} value={language} className={SEGMENT}>
          {current === language && (
            <motion.span
              layoutId={layoutIds.languageChoice}
              transition={springs.snappy}
              className="absolute inset-0 rounded-full bg-surface shadow-xs"
            />
          )}
          <Radio.Content className={SEGMENT_CONTENT}>{NAMES[language]}</Radio.Content>
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
