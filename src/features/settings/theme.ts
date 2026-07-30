/**
 * Which theme the app wears, and where that choice is kept.
 *
 * In localStorage rather than alongside the sidecar-backed preferences, for one
 * reason: this has to be applied before the first paint. Every other preference
 * can arrive a tick late and only fills a form; a theme that arrives a tick late
 * is a white flash on a dark desktop. localStorage reads synchronously, so
 * `applyStoredTheme()` can run at the top of main.tsx, before React mounts.
 *
 * The parsing and resolving halves are pure and live apart from the two DOM
 * calls, so the interesting logic — an unknown stored value, the system
 * following the OS — is testable without a document.
 */

/** What the user picked. `system` is a standing instruction, not a value. */
export type ThemePreference = "light" | "dark" | "system";

/** What the app actually wears once `system` has been resolved. */
export type ResolvedTheme = "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["light", "dark", "system"];

const STORAGE_KEY = "sonarche.theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * A stored value we do not recognise falls back to `system` rather than to a
 * fixed theme: an unreadable preference means we do not know what the user
 * wants, and following the OS is the honest answer to that.
 */
export function parsePreference(raw: string | null): ThemePreference {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference !== "system") return preference;
  return systemPrefersDark ? "dark" : "light";
}

/** Storage throws rather than returning null when it is unavailable (private
 * windows, a hardened webview), and a theme is never worth taking the app down
 * for — both accessors swallow and carry on with the default. */
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
    // Nothing to do: the theme still applies for this session.
  }
}

export function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Subscribes to the OS switching theme. Returns its own unsubscribe, so the
 * effect that owns it has a cleanup to return. */
export function watchSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  const handler = (event: MediaQueryListEvent) => onChange(event.matches);
  query.addEventListener("change", handler);
  return () => query.removeEventListener("change", handler);
}

/**
 * The one place that writes the attribute. `data-theme` and not a `.dark` class
 * because that is what theme.css keys off — and HeroUI answers to both, so the
 * whole component layer follows from this single line.
 */
export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.setAttribute("data-theme", theme);
  // index.html paints `--background` straight onto <html> before the stylesheet
  // exists, to kill the launch flash. By the time anything calls this the
  // stylesheet is in and owns the colour, and an inline background left behind
  // would be a frozen copy of whichever theme the app happened to open in.
  document.documentElement.style.removeProperty("background");
}

/** Boot path: read, resolve, apply, before anything renders. */
export function applyStoredTheme(): void {
  applyTheme(resolveTheme(readStoredPreference(), systemPrefersDark()));
}
