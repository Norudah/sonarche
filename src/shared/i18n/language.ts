/**
 * The app language, stored in localStorage (like `theme.ts`) because i18next
 * needs it synchronously at `init()`. With no stored choice the OS locale
 * decides; French is the fallback for unsupported locales.
 */

export type Language = "fr" | "en";

export const LANGUAGES: readonly Language[] = ["fr", "en"];

const STORAGE_KEY = "sonarche.language";

const FALLBACK: Language = "fr";

export function parseLanguage(raw: string | null | undefined): Language | null {
  return raw === "fr" || raw === "en" ? raw : null;
}

/** Matches on the primary subtag (`en-GB` → `en`). */
export function matchLanguage(locale: string | null | undefined): Language {
  const primary = locale?.split("-")[0]?.toLowerCase();
  return parseLanguage(primary) ?? FALLBACK;
}

export function readStoredLanguage(): Language | null {
  try {
    return parseLanguage(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function storeLanguage(language: Language): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage unavailable: the choice holds for this session.
  }
}

export function initialLanguage(): Language {
  return readStoredLanguage() ?? matchLanguage(typeof navigator === "undefined" ? null : navigator.language);
}

/** i18next doesn't set `<html lang>`, which screen readers and `:lang()` use. */
export function applyDocumentLanguage(language: Language): void {
  document.documentElement.setAttribute("lang", language);
}
