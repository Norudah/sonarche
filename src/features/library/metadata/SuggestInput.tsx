import { PenLine } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { filterSuggestions, hasExactSuggestion, type SuggestKind, type Suggestion } from "./suggestions";
import { useSuggestionPool } from "./SuggestionsContext";

const MAX_SHOWN = 8;
/** Readable even beside a narrow field. */
const MIN_LIST_PX = 288;
const MAX_LIST_PX = 224;
const EDGE_PX = 8;

/** Viewport position: below the field, or above it near the bottom edge. */
interface Placement {
  left: number;
  top: number | null;
  bottom: number | null;
  width: number;
  maxHeight: number;
}

/**
 * Text input suggesting existing library values; selecting writes the stored
 * string exactly (so "ac/dc" doesn't split from "AC/DC"). Free text stays
 * valid, shown as its own row. Nothing is highlighted by default, so Enter
 * never swaps typed text for a match.
 *
 * The list is portaled to `body` (ancestors clip it) and positioned from the
 * input's rect; see the top-layer attribute below.
 */
export function SuggestInput({
  value,
  onChange,
  suggest,
  onBlur,
  onKeyDown,
  ...inputProps
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  suggest?: SuggestKind;
}) {
  const { t } = useTranslation("library");
  const listId = useId();
  const pool = useSuggestionPool(suggest);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const typed = value.trim();
  const matches = pool && isOpen ? filterSuggestions(pool, typed).slice(0, MAX_SHOWN) : [];
  // The free-text row: shows what will be written when it's not an entry.
  const hasFreeRow = pool != null && isOpen && typed !== "" && !hasExactSuggestion(pool, typed);
  const rowCount = matches.length + (hasFreeRow ? 1 : 0);
  const isShown = isOpen && rowCount > 0;

  // Re-read on scroll (capture: the scrolling ancestor isn't the window) and resize.
  useLayoutEffect(() => {
    if (!isShown) {
      setPlacement(null);
      return;
    }
    const update = () => {
      const anchor = inputRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.max(rect.width, MIN_LIST_PX);
      const left = Math.min(Math.max(EDGE_PX, rect.left), window.innerWidth - width - EDGE_PX);
      const below = window.innerHeight - rect.bottom - EDGE_PX;
      const above = rect.top - EDGE_PX;
      const openUpward = below < 160 && above > below;
      setPlacement({
        left,
        top: openUpward ? null : rect.bottom + 4,
        bottom: openUpward ? window.innerHeight - rect.top + 4 : null,
        width,
        maxHeight: Math.max(80, Math.min(MAX_LIST_PX, openUpward ? above : below)),
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isShown]);

  const close = () => {
    setIsOpen(false);
    setHighlight(-1);
  };

  const select = (suggestion: Suggestion | null) => {
    if (suggestion) onChange(suggestion.value);
    close();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (pool) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!isShown) {
          setIsOpen(true);
          return;
        }
        const step = event.key === "ArrowDown" ? 1 : -1;
        // Cycles through -1 (nothing) and 0..rowCount-1.
        setHighlight((prev) => ((prev + 1 + step + rowCount + 1) % (rowCount + 1)) - 1);
        return;
      }
      if (event.key === "Enter" && isShown && highlight >= 0) {
        event.preventDefault();
        select(highlight < matches.length ? matches[highlight] : null);
        return;
      }
      // So the drawer/modal Escape listener leaves it to us.
      if (event.key === "Escape" && isShown) {
        event.preventDefault();
        close();
        return;
      }
    }
    onKeyDown?.(event);
  };

  return (
    <div className="relative">
      <input
        {...inputProps}
        ref={inputRef}
        type="text"
        value={value}
        role={pool ? "combobox" : undefined}
        aria-autocomplete={pool ? "list" : undefined}
        aria-expanded={pool ? isShown : undefined}
        aria-controls={pool ? listId : undefined}
        aria-activedescendant={highlight >= 0 ? `${listId}-${highlight}` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          if (pool) {
            setIsOpen(true);
            setHighlight(-1);
          }
        }}
        onBlur={(event) => {
          close();
          onBlur?.(event);
        }}
        onKeyDown={handleKeyDown}
      />

      {isShown &&
        placement != null &&
        createPortal(
          <ul
            id={listId}
            role="listbox"
            // react-aria marks everything outside an open modal `inert`, portals
            // included; this attribute (used by its toast region) exempts the list.
            data-react-aria-top-layer="true"
            // Keeps the input focused; a blur would close the list before the click lands.
            onMouseDown={(event) => event.preventDefault()}
            style={{
              left: placement.left,
              top: placement.top ?? undefined,
              bottom: placement.bottom ?? undefined,
              width: placement.width,
              maxHeight: placement.maxHeight,
            }}
            className="fixed z-[80] overflow-y-auto rounded-xl bg-surface py-1 shadow-xl ring-1 ring-separator"
          >
            {matches.map((suggestion, index) => (
              <li
                key={suggestion.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={highlight === index}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => select(suggestion)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 ${highlight === index ? "bg-default/60" : ""}`}
              >
                {/* Covers help tell editions apart; the empty slot keeps rows aligned. */}
                {suggest === "album" &&
                  (suggestion.image ? (
                    <img
                      src={suggestion.image}
                      alt=""
                      loading="lazy"
                      className="size-6 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span className="size-6 shrink-0 rounded bg-default/60" />
                  ))}
                <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-foreground">{suggestion.value}</span>
                {suggestion.detail && (
                  <span className="max-w-36 truncate text-[0.6875rem] text-muted">{suggestion.detail}</span>
                )}
                <span className="shrink-0 text-[0.6875rem] text-muted/70 tabular-nums">
                  {t("metadata.suggest.count", { count: suggestion.count })}
                </span>
              </li>
            ))}

            {hasFreeRow && (
              <li
                id={`${listId}-${matches.length}`}
                role="option"
                aria-selected={highlight === matches.length}
                onMouseEnter={() => setHighlight(matches.length)}
                onClick={() => select(null)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 ${
                  matches.length > 0 ? "border-t border-separator/60" : ""
                } ${highlight === matches.length ? "bg-default/60" : ""}`}
              >
                <PenLine className="size-3 shrink-0 text-muted" />
                <span className="min-w-0 truncate text-[0.8125rem] text-foreground">{typed}</span>
                <span className="shrink-0 text-[0.6875rem] text-muted">{t("metadata.suggest.newValue")}</span>
              </li>
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}
