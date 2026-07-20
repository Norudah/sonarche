import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { springs } from "@/shared/motion/tokens";

export const GENRE_SCOPES = ["families", "genres"] as const;
export type GenreScope = (typeof GENRE_SCOPES)[number];

interface ScopeToggleProps {
  value: GenreScope;
  onChange: (value: GenreScope) => void;
}

/**
 * Families or genres — the same page counted on two units.
 *
 * A segmented control rather than a `SortSelect`, because this does not reorder
 * anything: it changes what a row *is*. A dropdown would file it next to
 * "sort by year" and hide the second half of the page behind a menu.
 *
 * The moving pill is a `layoutId`, the same device as the sidebar's active
 * marker, so switching reads as one indicator travelling rather than two
 * backgrounds blinking.
 */
export function ScopeToggle({ value, onChange }: ScopeToggleProps) {
  const { t } = useTranslation("library");

  return (
    <div role="tablist" className="flex h-9 items-center gap-1 rounded-full bg-surface-secondary p-1">
      {GENRE_SCOPES.map((scope) => {
        const isActive = scope === value;
        return (
          <button
            key={scope}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(scope)}
            className={
              "relative cursor-pointer rounded-full px-3 py-1 text-[0.8125rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 " +
              (isActive ? "text-foreground" : "text-muted hover:text-foreground")
            }
          >
            {isActive && (
              <motion.span
                layoutId="genre-scope-pill"
                transition={springs.snappy}
                className="absolute inset-0 rounded-full bg-surface shadow-sm"
              />
            )}
            <span className="relative">{t(`genres.scope.${scope}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
