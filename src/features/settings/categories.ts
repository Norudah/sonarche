import { Gauge, KeyRound, Palette, RefreshCw, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { paths } from "@/app/paths";

export interface SettingsCategory {
  path: string;
  /** Key into the `settings` namespace, e.g. `apiKeys.category`. */
  labelKey: string;
  icon: LucideIcon;
}

// A category the settings feature lists but does not own: the pane is
// `features/update`, mounted by the router. The label lives here because the
// sidebar is what needs it, and features do not import each other.

/** The one list the sidebar and the router agree on. The developer category is
 * compiled out of release builds, mirroring its route guard in `routes.tsx`. */
export const settingsCategories: SettingsCategory[] = [
  { path: paths.settingsAppearance, labelKey: "appearance.category", icon: Palette },
  { path: paths.settingsApiKeys, labelKey: "apiKeys.category", icon: KeyRound },
  { path: paths.settingsRateLimits, labelKey: "rateLimits.category", icon: Gauge },
  { path: paths.settingsUpdates, labelKey: "updates.category", icon: RefreshCw },
  ...(import.meta.env.DEV
    ? [{ path: paths.settingsDeveloper, labelKey: "developer.category", icon: Wrench } satisfies SettingsCategory]
    : []),
];
