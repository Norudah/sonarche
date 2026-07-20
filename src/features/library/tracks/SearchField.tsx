import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/** Long enough to swallow a burst of typing, short enough that the list still
 * feels like it answers the keystroke. */
const DEBOUNCE_MS = 200;

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Hand-rolled rather than HeroUI's InputGroup: its field tokens resolve to a
 * white background with a zero-width border, which disappears on our near-white
 * page, and its component-layer rules won over every override we tried. A
 * filled pill is two elements — not worth fighting the primitive for.
 *
 * The field owns the text; the page is told about it on a delay. Typing
 * "radiohead" used to run nine full filter passes over the library and rebuild
 * the list nine times, eight of them for a prefix nobody was searching for —
 * and that cost grows with the library, which is exactly backwards.
 *
 * The debounce is here and not in the pages because all four of them (tracks,
 * albums, artists, genres) share this field, and a delay applied per page is a
 * delay that will be forgotten on the fifth.
 *
 * Clearing skips the delay: the button is an explicit "show me everything
 * again", and making that wait feels broken.
 */
export function SearchField({ value, onChange }: SearchFieldProps) {
  const { t } = useTranslation("library");
  // The input must echo the keystroke immediately — only the *filtering* is
  // deferred. A field that lags behind the keyboard reads as a frozen app.
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A pending keystroke must not fire after the field is gone: the page that
  // owns the query may already have unmounted with the route.
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
        // Enter means "I have finished typing" and Escape means "drop it" —
        // both are answers to the delay, so neither should have to wait it out.
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
