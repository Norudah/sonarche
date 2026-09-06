import { settingsGroups } from "@/features/settings/categories";
import { createTextFilter } from "@/shared/lib/search";
import type { SettingsCategoryId } from "@/shared/lib/settingsDialog";

export interface SettingsEntry {
  /** What the entry points at: a setting's i18n base key (`appearance.theme`,
   * `danger.erase`), or a bare category id for the pane itself. Rows and cards
   * publish the former as `data-setting`, which is how a result rings the exact
   * thing it found. */
  key: string;
  category: SettingsCategoryId;
  /** Where the entry lives, one level up — a setting names its pane, a pane
   * names its group. Both read the same way under a result. */
  parentLabel: string;
  name: string;
  why: string;
}

/**
 * Every setting the dialog holds, read off the translation bundle rather than
 * listed by hand.
 *
 * The locale files already say it: a setting is an object under a category
 * that names itself (`appearance.theme.name`). Deriving the index from that
 * shape means a setting cannot be added to a pane and forgotten here — which
 * is the failure mode of every hand-maintained search table, and the one that
 * makes a search field worse than none, because it teaches people the search
 * misses things.
 *
 * Only the direct children of a category count. One level deeper lives detail
 * that names itself for other reasons — the three audio formats, the two fixed
 * service delays — and none of those is a setting you go looking for.
 *
 * The panes are indexed too, on their own lede. Some of what someone searches
 * for is true of a whole pane and of no single row in it: "keychain" is where
 * the API keys are kept, and it is stated once, at the top of Services.
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

/**
 * The same free-text semantics as every other search in the app: each term has
 * to land somewhere. The reason is part of the haystack, which is the point —
 * someone types "403" or "trousseau", words that appear in no setting's name.
 */
export const filterSettings = createTextFilter<SettingsEntry>(
  (entry) => `${entry.name} ${entry.why} ${entry.parentLabel}`,
);
