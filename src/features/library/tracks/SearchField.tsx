import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Hand-rolled rather than HeroUI's InputGroup: its field tokens resolve to a
 * white background with a zero-width border, which disappears on our near-white
 * page, and its component-layer rules won over every override we tried. A
 * filled pill is two elements — not worth fighting the primitive for.
 */
export function SearchField({ value, onChange }: SearchFieldProps) {
  const { t } = useTranslation("library");

  return (
    <div className="flex h-9 w-56 items-center gap-2 rounded-full bg-surface-secondary px-3 transition-colors hover:bg-surface-tertiary focus-within:bg-surface focus-within:ring-2 focus-within:ring-accent/30">
      <Search className="size-4 shrink-0 text-muted" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("search.placeholder")}
        aria-label={t("search.label")}
        className="min-w-0 flex-1 bg-transparent text-[0.8125rem] text-foreground outline-none placeholder:text-muted"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("search.clear")}
          className="shrink-0 cursor-pointer rounded-full p-0.5 text-muted transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
