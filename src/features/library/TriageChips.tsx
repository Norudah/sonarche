import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface TriageChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface TriageChipsProps {
  chips: TriageChip[];
  /** Pre-formatted count of what the active filters leave ("21 tracks"). */
  countLabel: string;
}

/**
 * The active deep-link filters, shown as removable chips so a page reached
 * from the Metadata queue says what it is filtered on. The whole chip is the
 * remove button: the filter has no other state to toggle, and a separate ×
 * hit-zone at this size is a misclick trap.
 */
export function TriageChips({ chips, countLabel }: TriageChipsProps) {
  const { t } = useTranslation("library");

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          aria-label={t("triage.clearFilter", { filter: chip.label })}
          className="group flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-[0.8125rem] text-accent-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {chip.label}
          <X className="size-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
        </button>
      ))}
      <span className="text-[0.8125rem] text-muted tabular-nums">{countLabel}</span>
    </div>
  );
}
