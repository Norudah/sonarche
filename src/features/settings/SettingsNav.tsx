import { cn } from "@heroui/react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { settingsCategories, settingsGroups, type SettingsCategory } from "@/features/settings/categories";
import { buildSettingsIndex, filterSettings } from "@/features/settings/settingsIndex";
import { SettingsSearchField, SettingsSearchResults } from "@/features/settings/SettingsSearch";
import { revealSetting, selectSettingsCategory, type SettingsCategoryId } from "@/shared/lib/settingsDialog";
import { layoutIds, springs } from "@/shared/motion/tokens";

function CategoryButton({
  category,
  isActive,
  className,
}: {
  category: SettingsCategory;
  isActive: boolean;
  className?: string;
}) {
  const { t } = useTranslation("settings");
  const { icon: Icon } = category;

  return (
    <button
      type="button"
      onClick={() => selectSettingsCategory(category.id)}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-[0.8125rem] font-medium",
        "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40",
        isActive ? "text-accent" : "text-muted hover:bg-default/50 hover:text-foreground",
        className,
      )}
    >
      {/* One pill for the whole menu, tweened between entries by the shared
          layoutId — the same device the app's own nav uses, so moving between
          settings categories feels like moving between pages. */}
      {isActive && (
        <motion.span
          layoutId={layoutIds.settingsNavIndicator}
          transition={springs.snappy}
          className="absolute inset-0 rounded-lg bg-accent/15"
        />
      )}
      <Icon className="relative size-4 shrink-0" />
      <span className="relative min-w-0 truncate">{t(category.labelKey)}</span>
    </button>
  );
}

/**
 * The dialog's own menu: three titled groups, never a flat list.
 *
 * The flat list is what made the old menu unfindable. Its seven entries were
 * of equal rank but not of equal kind, so nothing told you which axis a
 * setting had been filed on — and the only way to find one was to guess the
 * axis first. A heading over each group answers that before you read a single
 * entry: how the app behaves for you, what it owns on your disk, what it is.
 */
export function SettingsNav({ current }: { current: SettingsCategoryId }) {
  const { t, i18n } = useTranslation("settings");
  const [query, setQuery] = useState("");

  // Rebuilt only when the language changes: the bundle is the translated one,
  // so a switch to English has to re-read it — nothing else can move it.
  const language = i18n.resolvedLanguage ?? "fr";
  const entries = useMemo(
    () => buildSettingsIndex(i18n.getResourceBundle(language, "settings"), (key) => t(key)),
    [i18n, language, t],
  );

  const isSearching = query.trim().length > 0;
  const results = isSearching ? filterSettings(entries, query) : [];

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-separator bg-panel md:flex">
      <div className="flex flex-col gap-3 px-4 pt-5 pb-3">
        <p className="px-1 text-[0.9375rem] font-semibold tracking-tight">{t("title")}</p>
        <SettingsSearchField value={query} onChange={setQuery} />
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pt-1 pb-4">
        {isSearching ? (
          <SettingsSearchResults
            results={results}
            onPick={(entry) => {
              // The query goes with the pick: the menu is a menu again, and
              // the pane it just opened is the answer — leaving the results up
              // would put the user back in front of the question.
              setQuery("");
              revealSetting(entry.category, entry.key);
            }}
          />
        ) : (
          settingsGroups.map((group) => (
            <div key={group.labelKey} className="flex flex-col gap-1">
              {/* Same register as the app sidebar's section labels: a signpost
                  to be found when looked for, not read on the way past. */}
              <p className="px-3 text-[10px] font-semibold tracking-widest text-muted/70 uppercase">
                {t(group.labelKey)}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.categories.map((category) => (
                  <CategoryButton key={category.id} category={category} isActive={category.id === current} />
                ))}
              </div>
            </div>
          ))
        )}
      </nav>
    </aside>
  );
}

/**
 * What the menu becomes when the window is too narrow to spend 15rem on it: one
 * scrollable row of the same entries, in the same order, groups implied by it.
 * Headings are the first thing to go — they cost a line each and the whole list
 * is visible at once here anyway.
 *
 * The frame around it (border, ground, and the close button beside it) belongs
 * to the caller: this is one scrolling lane in that row, not the row itself.
 *
 * No search down here. It needs a field, a result list and somewhere to put
 * them, and this layout exists precisely because there is no room — the rail
 * comes back with the width.
 */
export function SettingsNavStrip({ current }: { current: SettingsCategoryId }) {
  return (
    <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-3 py-2">
      {settingsCategories.map((category) => (
        <CategoryButton key={category.id} category={category} isActive={category.id === current} className="shrink-0" />
      ))}
    </div>
  );
}
