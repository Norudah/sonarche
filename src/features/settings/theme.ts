/** The theme, in localStorage so `applyStoredTheme()` runs before React mounts
 * (no flash). Parsing and resolution are pure, apart from the DOM calls. */

/** `system` follows the OS. */
export type ThemePreference = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["light", "dark", "system"];

const STORAGE_KEY = "sonarche.theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Unknown values fall back to `system`. */
export function parsePreference(raw: string | null): ThemePreference {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference !== "system") return preference;
  return systemPrefersDark ? "dark" : "light";
}

/** Storage can throw; both accessors fall back silently. */
export function readStoredPreference(): ThemePreference {
  try {
    return parsePreference(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function storePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Storage unavailable: the theme holds for this session.
  }
}

export function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Returns its own unsubscribe. */
export function watchSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  const handler = (event: MediaQueryListEvent) => onChange(event.matches);
  query.addEventListener("change", handler);
  return () => query.removeEventListener("change", handler);
}

/** Sets `data-theme`, which theme.css and HeroUI key off. */
export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.setAttribute("data-theme", theme);
  // Remove index.html's pre-stylesheet background, which would freeze the launch theme.
  document.documentElement.style.removeProperty("background");
}

/** Boot path, before anything renders. */
export function applyStoredTheme(): void {
  applyTheme(resolveTheme(readStoredPreference(), systemPrefersDark()));
}
