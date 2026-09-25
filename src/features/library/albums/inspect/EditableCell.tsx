import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SuggestInput } from "@/features/library/metadata/SuggestInput";
import type { SuggestKind } from "@/features/library/metadata/suggestions";

/** A button showing the value, swapped for an input on focus (hundreds of
 * live inputs would be heavy). Empty cells name what's missing, in amber. */
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
  /** Set when the cell is part of the pending save. */
  origin?: string;
  /** Includes the track title for screen readers. */
  label: string;
  align?: "left" | "center";
  /** Shown when empty is a problem. */
  missingLabel?: string;
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
        // Keeps focus when the button is swapped for the input.
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
      // The pointer signals the cell is editable.
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
