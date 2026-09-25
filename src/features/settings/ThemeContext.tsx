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
  /** Stored and shown in the control. */
  preference: ThemePreference;
  /** What the app actually shows. */
  resolved: ResolvedTheme;
  choose: (next: ThemePreference) => void;
}

/** App-wide theme state, at the root so `system` follows OS changes on any
 * screen. The preference and the OS value are kept apart so an OS change never
 * rewrites the user's choice. */
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(readStoredPreference);
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  useEffect(() => watchSystemTheme(setPrefersDark), []);

  const resolved = resolveTheme(preference, prefersDark);

  // The attribute lives on <html>, outside React.
  useEffect(() => applyTheme(resolved), [resolved]);

  // The window gets the preference: only an unpinned window (`system`) reports
  // the OS theme to `prefers-color-scheme`.
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
