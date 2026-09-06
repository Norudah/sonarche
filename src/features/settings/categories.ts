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
  /** Key into the `settings` namespace, e.g. `services.category`. */
  labelKey: string;
  icon: LucideIcon;
}

export interface SettingsGroup {
  labelKey: string;
  categories: SettingsCategory[];
}

/**
 * The menu, in three titled groups.
 *
 * A flat list is what made the old menu unfindable: seven entries of equal
 * rank that were not of equal kind — preferences next to a disk location next
 * to an outside account next to the app's own version. Nothing said which axis
 * a setting had been filed on, so finding one meant guessing the axis first.
 *
 * Each group answers a different question, and every category belongs to
 * exactly one of them: how the app behaves *for you*, what it *owns* on your
 * machine, and what it *is*. Two consequences worth naming, because both moved
 * a setting out of the folder someone might remember:
 *
 * - the audio format now sits with the files it describes, not with the
 *   download page that happens to apply it — it is the one setting that
 *   rewrites bytes, and its button converts the whole library;
 * - the API keys and the request pacing became one pane. From the outside "my
 *   key stopped working", "the service is down" and "I got rate-limited" are
 *   one symptom, and a category holding a single slider was never a door worth
 *   opening.
 */
export const settingsGroups: SettingsGroup[] = [
  {
    labelKey: "groups.you",
    categories: [
      { id: "appearance", labelKey: "appearance.category", icon: Palette },
      { id: "adding", labelKey: "adding.category", icon: Download },
      // Same icon as the Metadata destination in the main nav: the category
      // tunes that page, and the two entries should read as the same thing.
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
      // Last, always, and named for what it holds. Five irreversible actions
      // deserve a label that announces them rather than a scroll that reveals
      // them at the foot of an ordinary page.
      { id: "danger", labelKey: "danger.category", icon: ShieldAlert },
      // Compiled out of release builds; every command behind it refuses to run
      // there anyway.
      ...(import.meta.env.DEV
        ? [{ id: "developer", labelKey: "developer.category", icon: FlaskConical } satisfies SettingsCategory]
        : []),
    ],
  },
];

/** Flattened, in menu order — what the search index and the pane resolver walk. */
export const settingsCategories: SettingsCategory[] = settingsGroups.flatMap((group) => group.categories);
