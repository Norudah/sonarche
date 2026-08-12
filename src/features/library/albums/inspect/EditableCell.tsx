import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SuggestInput } from "@/features/library/metadata/SuggestInput";
import type { SuggestKind } from "@/features/library/metadata/suggestions";

/**
 * A tracklist cell: plain text until you reach it, a real input once you do.
 *
 * The panel is always editable, but mounting an `<input>` per cell would put
 * four of them on every row — a 29-track record would carry 116, an 80-track
 * soundtrack over 300, all of them live at once. So the resting state is a
 * button showing the value, and the input is mounted only for the cell that
 * holds focus. Keyboard travel is unaffected: the button takes focus, swaps
 * itself for the input, and the input picks the focus straight back up.
 *
 * An empty cell says what is missing rather than showing a blank — the amber is
 * the same "incomplete metadata" hue the tag dots and the completion ring use.
 */
export function EditableCell({
  value,
  origin,
  label,
  align = "left",
  missingLabel,
  suggest,
  onChange,
}: {
  value: string;
  /** Set when the cell has moved, i.e. it is part of the pending save. */
  origin?: string;
  /** Accessible name — carries the track title, so twenty "Titre" cells don't
   * read as twenty identical fields to a screen reader. */
  label: string;
  align?: "left" | "center";
  /** What an empty cell should say, when leaving it empty is a problem. */
  missingLabel?: string;
  /** Pool to suggest from while typing — only mounted with the input itself. */
  suggest?: SuggestKind;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation("library");
  const [isActive, setIsActive] = useState(false);

  const isEmpty = value.trim() === "";
  const box = `h-7 w-full min-w-0 rounded-lg px-2 text-[0.8125rem] outline-none transition-colors ${
    align === "center" ? "text-center tabular-nums" : "text-left"
  } ${origin != null ? "border-l-[3px] border-l-accent" : ""}`;

  if (isActive) {
    return (
      <SuggestInput
        // The cell just took focus as a button; without this, swapping it for
        // the input would drop that focus on the floor.
        autoFocus
        aria-label={label}
        value={value}
        suggest={suggest}
        onChange={onChange}
        onBlur={() => setIsActive(false)}
        className={`${box} border border-accent bg-surface text-foreground ring-2 ring-accent/25`}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onFocus={() => setIsActive(true)}
      onClick={() => setIsActive(true)}
      // A pointer, because it is one: without it the row reads as a printed
      // table and nobody discovers the cells are live.
      className={`${box} cursor-pointer truncate border border-transparent hover:bg-default/60 ${
        isEmpty && missingLabel
          ? "border-dashed border-warning/40 bg-warning-soft text-[0.75rem] text-warning"
          : isEmpty
            ? "text-muted/50"
            : "text-foreground"
      }`}
    >
      {isEmpty ? (missingLabel ?? t("metadata.emptyValue")) : value}
    </button>
  );
}
