import { Radio, RadioGroup } from "@heroui/react";
import { motion } from "motion/react";

import { LANGUAGES, type Language } from "@/features/settings/language";
import { useLanguage } from "@/features/settings/useLanguage";
import { layoutIds, springs } from "@/shared/motion/tokens";

/* The segmented grammar the theme control used to wear, and the shape this
 * choice actually wants: two words, no picture to show, one pill sliding
 * between them. The theme moved to tiles because a theme can be drawn; a
 * language cannot, and a flag would name a country rather than a language. */
const SEGMENT = "relative mt-0 flex-1 rounded-full";
const SEGMENT_CONTENT =
  "relative w-full justify-center px-3 py-2 text-[0.8125rem] font-medium whitespace-nowrap " +
  "transition-colors text-muted hover:text-foreground data-[selected]:text-accent";

/** Endonyms, untranslated on purpose: someone who cannot read the language the
 * app is currently in still has to recognise their own in this list. */
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
