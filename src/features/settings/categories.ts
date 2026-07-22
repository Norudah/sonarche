import { Gauge, KeyRound, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { paths } from "@/app/paths";

export interface SettingsCategory {
  path: string;
  /** Key into the `settings` namespace, e.g. `apiKeys.category`. */
  labelKey: string;
  icon: LucideIcon;
}

/** The one list the sidebar and the router agree on. The developer category is
 * compiled out of release builds, mirroring its route guard in `routes.tsx`. */
export const settingsCategories: SettingsCategory[] = [
  { path: paths.settingsApiKeys, labelKey: "apiKeys.category", icon: KeyRound },
  { path: paths.settingsRateLimits, labelKey: "rateLimits.category", icon: Gauge },
  ...(import.meta.env.DEV
    ? [{ path: paths.settingsDeveloper, labelKey: "developer.category", icon: Wrench } satisfies SettingsCategory]
    : []),
];
