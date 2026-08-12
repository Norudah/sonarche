/**
 * Which language the app speaks, and where that choice is kept.
 *
 * Beside `theme.ts` and stored the same way, for the same reason: i18next needs
 * an answer at `init()`, before React mounts. A language that arrives a tick
 * late is a screenful of French replaced by English in front of the user.
 * localStorage reads synchronously; the sidecar-backed preferences do not.
 *
 * Nothing stored means nothing chosen, so the OS gets the first word — an
 * English desktop opens the app in English rather than in the author's own
 * language. French is the fallback, not the default: it is what an unreadable
 * or unsupported locale lands on.
 */

export type Language = "fr" | "en";

export const LANGUAGES: readonly Language[] = ["fr", "en"];

const STORAGE_KEY = "sonarche.language";

const FALLBACK: Language = "fr";

export function parseLanguage(raw: string | null | undefined): Language | null {
  return raw === "fr" || raw === "en" ? raw : null;
}

/**
 * A browser locale down to a language we speak. Tags carry a region
 * (`en-GB`, `fr-CA`), so the match is on the primary subtag alone.
 */
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
    // Nothing to do: the choice still holds for this session.
  }
}

/** What the app should open in: the stored choice, else the desktop's. */
export function initialLanguage(): Language {
  return readStoredLanguage() ?? matchLanguage(typeof navigator === "undefined" ? null : navigator.language);
}

/**
 * Keeps the document in step with i18next. Screen readers pick their voice from
 * this attribute, and `:lang()` rules key off it — neither of which i18next
 * touches on its own.
 */
export function applyDocumentLanguage(language: Language): void {
  document.documentElement.setAttribute("lang", language);
}
