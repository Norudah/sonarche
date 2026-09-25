import {
  Download,
  FileText,
  FlaskConical,
  Globe,
  HardDrive,
  Palette,
  RefreshCw,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { SettingsCategoryId } from "@/shared/lib/settingsDialog";

export interface SettingsCategory {
  id: SettingsCategoryId;
  /** Key in the `settings` namespace. */
  labelKey: string;
  icon: LucideIcon;
}

interface SettingsGroup {
  labelKey: string;
  categories: SettingsCategory[];
}

/**
 * The menu in three groups: how the app behaves (Preferences), what it holds
 * on disk (Library), and the app itself (Application). The audio format sits
 * with the files it rewrites; API keys and request pacing share one pane.
 */
export const settingsGroups: SettingsGroup[] = [
  {
    labelKey: "groups.preferences",
    categories: [
      { id: "appearance", labelKey: "appearance.category", icon: Palette },
      { id: "adding", labelKey: "adding.category", icon: Download },
      // Same icon as the Metadata page in the main nav.
      { id: "metadata", labelKey: "metadata.category", icon: FileText },
    ],
  },
  {
    labelKey: "groups.library",
    categories: [
      { id: "files", labelKey: "files.category", icon: HardDrive },
      { id: "services", labelKey: "services.category", icon: Globe },
    ],
  },
  {
    labelKey: "groups.app",
    categories: [
      { id: "updates", labelKey: "updates.category", icon: RefreshCw },
      { id: "advanced", labelKey: "advanced.category", icon: Wrench },
      // Always last.
      { id: "danger", labelKey: "danger.category", icon: ShieldAlert },
      // Compiled out of release builds.
      ...(import.meta.env.DEV
        ? [{ id: "developer", labelKey: "developer.category", icon: FlaskConical } satisfies SettingsCategory]
        : []),
    ],
  },
];

/** In menu order, for the search index and the pane resolver. */
export const settingsCategories: SettingsCategory[] = settingsGroups.flatMap((group) => group.categories);
