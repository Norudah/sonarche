import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/** Swallows a word typed at speed; still feels immediate. */
const DEBOUNCE_MS = 275;

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Hand-rolled: HeroUI's InputGroup is invisible on our near-white page and
 * resists overrides. The input echoes immediately; the page is told after a
 * debounce (here, shared by every search). Clearing skips the delay.
 */
export function SearchField({ value, onChange }: SearchFieldProps) {
  const { t } = useTranslation("library");
  // Echo keystrokes immediately; only filtering is deferred.
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Don't fire after unmount.
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  const push = (next: string, immediate = false) => {
    setText(next);
    clearTimeout(timer.current ?? undefined);
    if (immediate) {
      onChange(next);
      return;
    }
    timer.current = setTimeout(() => onChange(next), DEBOUNCE_MS);
  };

  return (
    <div className="flex h-9 w-56 items-center gap-2 rounded-full bg-surface-secondary px-3 transition-colors hover:bg-surface-tertiary focus-within:bg-surface focus-within:ring-2 focus-within:ring-accent/30">
      <Search className="size-4 shrink-0 text-muted" />
      <input
        type="text"
        value={text}
        onChange={(event) => push(event.target.value)}
        // Enter and Escape skip the delay.
        onKeyDown={(event) => {
          if (event.key === "Enter") push(text, true);
          if (event.key === "Escape") push("", true);
        }}
        placeholder={t("search.placeholder")}
        aria-label={t("search.label")}
        className="min-w-0 flex-1 bg-transparent text-[0.8125rem] text-foreground outline-none placeholder:text-muted"
      />
      {text && (
        <button
          type="button"
          onClick={() => push("", true)}
          aria-label={t("search.clear")}
          className="shrink-0 cursor-pointer rounded-full p-0.5 text-muted transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
