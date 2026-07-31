import { useTranslation } from "react-i18next";

import { applyDocumentLanguage, parseLanguage, storeLanguage, type Language } from "@/features/settings/language";

/**
 * The live language, and the choice behind it.
 *
 * No context of its own: i18next already is one — it holds the current
 * language and re-renders every `useTranslation` consumer when it changes.
 * This only adds the two things it does not do, which is remembering the answer
 * and telling the document about it.
 */
export function useLanguage(): { current: Language; choose: (next: Language) => void } {
  const { i18n } = useTranslation();

  // `resolvedLanguage` and not `language`: the first is what is actually being
  // read after the fallback chain has run, which is what the control must show.
  const current = parseLanguage(i18n.resolvedLanguage) ?? "fr";

  function choose(next: Language) {
    if (next === current) return;
    void i18n.changeLanguage(next);
    storeLanguage(next);
    applyDocumentLanguage(next);
  }

  return { current, choose };
}
