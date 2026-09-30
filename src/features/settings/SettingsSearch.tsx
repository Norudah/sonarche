import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { SettingsEntry } from "@/features/settings/settingsIndex";

/** Searches the settings themselves, reasons included, not just pane names. */
export function SettingsSearchField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { t } = useTranslation("settings");

  return (
    <label className="flex items-center gap-2 rounded-lg border border-separator bg-surface px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-accent/40">
      <Search className="size-3.5 shrink-0 text-muted/70" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("search.placeholder")}
        aria-label={t("search.placeholder")}
        className="min-w-0 flex-1 bg-transparent text-[0.8125rem] outline-none placeholder:text-muted/70"
      />
    </label>
  );
}

/** Results replace the groups while searching: setting, then its pane. */
export function SettingsSearchResults({
  results,
  onPick,
}: {
  results: SettingsEntry[];
  onPick: (entry: SettingsEntry) => void;
}) {
  const { t } = useTranslation("settings");

  if (results.length === 0) {
    return <p className="px-3 py-8 text-center text-[0.8125rem] text-muted">{t("search.empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      {results.map((entry) => (
        <button
          key={entry.key}
          type="button"
          onClick={() => onPick(entry)}
          className="cursor-pointer rounded-lg px-3 py-1.5 text-left outline-none transition-colors hover:bg-default/50 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="block line-clamp-2 text-[0.8125rem] leading-snug font-medium text-foreground">
            {entry.name}
          </span>
          <span className="block truncate text-[10px] font-semibold tracking-widest text-muted/70 uppercase">
            {entry.parentLabel}
          </span>
        </button>
      ))}
    </div>
  );
}
