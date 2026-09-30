import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface TriageChip {
  key: string;
  label: string;
  /** "filter": browsing (accent). "correction": names something missing (amber). */
  tone?: "filter" | "correction";
  onRemove: () => void;
}

interface TriageChipsProps {
  chips: TriageChip[];
  /** Pre-formatted count; omitted where the bar states it once. */
  countLabel?: string;
}

/** Active deep-link filters as removable chips (the whole chip removes).
 * Amber marks corrections arriving from the Metadata page. */
const CHIP_TONE = {
  filter: "bg-accent-soft text-accent",
  correction: "bg-warning-soft text-warning",
} as const;

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
          className={`group flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-[0.8125rem] font-medium outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-accent/40 ${CHIP_TONE[chip.tone ?? "filter"]}`}
        >
          {chip.label}
          <X className="size-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
        </button>
      ))}
      {countLabel && <span className="text-[0.8125rem] text-muted tabular-nums">{countLabel}</span>}
    </div>
  );
}
