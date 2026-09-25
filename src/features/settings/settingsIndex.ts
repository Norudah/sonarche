import { settingsGroups } from "@/features/settings/categories";
import { createTextFilter } from "@/shared/lib/search";
import type { SettingsCategoryId } from "@/shared/lib/settingsDialog";

export interface SettingsEntry {
  /** A setting's i18n base key (`appearance.theme`) or a category id. Rows and
   * cards expose it as `data-setting` so results can highlight them. */
  key: string;
  category: SettingsCategoryId;
  /** A setting's pane, or a pane's group. */
  parentLabel: string;
  name: string;
  why: string;
}

/**
 * The search index, derived from the translation bundle so a new setting
 * can't be forgotten: a setting is an object under a category with a `name`.
 * Only direct children count. Panes are indexed too, by their lede.
 */
export function buildSettingsIndex(bundle: unknown, translate: (key: string) => string): SettingsEntry[] {
  if (typeof bundle !== "object" || bundle === null) return [];
  const root = bundle as Record<string, unknown>;

  return settingsGroups.flatMap((group) =>
    group.categories.flatMap((category) => {
      const node = root[category.id];
      if (typeof node !== "object" || node === null) return [];
      const pane = node as Record<string, unknown>;

      const paneEntry: SettingsEntry = {
        key: category.id,
        category: category.id,
        parentLabel: translate(group.labelKey),
        name: translate(category.labelKey),
        why: typeof pane.description === "string" ? pane.description : "",
      };

      const settings = Object.entries(pane).flatMap(([child, value]) => {
        if (typeof value !== "object" || value === null) return [];
        const setting = value as Record<string, unknown>;
        if (typeof setting.name !== "string") return [];

        return [
          {
            key: `${category.id}.${child}`,
            category: category.id,
            parentLabel: paneEntry.name,
            name: setting.name,
            why: typeof setting.why === "string" ? setting.why : "",
          },
        ];
      });

      return [paneEntry, ...settings];
    }),
  );
}

/** Reasons are part of the haystack, so "403" finds the right setting. */
export const filterSettings = createTextFilter<SettingsEntry>(
  (entry) => `${entry.name} ${entry.why} ${entry.parentLabel}`,
);
