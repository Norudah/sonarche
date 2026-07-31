import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { setWindowTheme } from "@/features/settings/api";
import {
  applyTheme,
  readStoredPreference,
  resolveTheme,
  storePreference,
  systemPrefersDark,
  watchSystemTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/features/settings/theme";

interface ThemeValue {
  /** What the user picked — what the control shows and what is stored. */
  preference: ThemePreference;
  /** What the app is actually wearing. */
  resolved: ResolvedTheme;
  choose: (next: ThemePreference) => void;
}

/**
 * The live theme, and the choice behind it.
 *
 * A context and not local state in the Appearance section, which is where this
 * used to live: the desktop flipping to dark repainted the app only while that
 * one page happened to be mounted. Anywhere else, `system` meant "the theme the
 * OS was wearing when the app launched". The subscription has to outlive the
 * screen that configures it, so it sits at the root.
 *
 * Two pieces of state rather than one: what the user asked for is what the
 * control shows and what gets stored, while what the OS reports only matters
 * when the answer is `system`. Keeping them apart means flipping the desktop
 * repaints the app without silently rewriting the user's choice.
 */
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(readStoredPreference);
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  // The OS is an external system and this is the subscription to it — the one
  // shape an effect is actually for. `watchSystemTheme` returns its own
  // unsubscribe, so the cleanup is the return value.
  useEffect(() => watchSystemTheme(setPrefersDark), []);

  const resolved = resolveTheme(preference, prefersDark);

  // The attribute lives on <html>, outside React's tree, so it is written in an
  // effect rather than during render. Keyed on the resolved theme so both paths
  // in — the user picking, and the OS changing under a `system` choice — land
  // here without the caller having to remember either.
  useEffect(() => applyTheme(resolved), [resolved]);

  // The native frame takes the *preference* and not the resolved theme: only
  // `system` may leave the window unpinned, and only an unpinned window reports
  // the desktop's real theme back to `prefers-color-scheme` above.
  useEffect(() => {
    setWindowTheme(preference);
  }, [preference]);

  function choose(next: ThemePreference) {
    setPreference(next);
    storePreference(next);
  }

  return <ThemeContext.Provider value={{ preference, resolved, choose }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within a ThemeProvider");
  return value;
}
