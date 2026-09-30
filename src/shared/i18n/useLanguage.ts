import { useTranslation } from "react-i18next";

import { applyDocumentLanguage, parseLanguage, storeLanguage, type Language } from "@/shared/i18n/language";

/** The current language and a setter that persists it and updates `<html lang>`. */
export function useLanguage(): { current: Language; choose: (next: Language) => void } {
  const { i18n } = useTranslation();

  // `resolvedLanguage` is the language actually in use after fallbacks.
  const current = parseLanguage(i18n.resolvedLanguage) ?? "fr";

  function choose(next: Language) {
    if (next === current) return;
    void i18n.changeLanguage(next);
    storeLanguage(next);
    applyDocumentLanguage(next);
  }

  return { current, choose };
}
