import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface TriageChip {
  key: string;
  label: string;
  /** "filter" (default) is browsing — a decade, a genre, a family. "correction"
   * is a filter that names something wrong or missing. */
  tone?: "filter" | "correction";
  onRemove: () => void;
}

interface TriageChipsProps {
  chips: TriageChip[];
  /** Pre-formatted count of what the active filters leave ("21 tracks"). Omitted
   * inside the tracks filter bar, which states the count once for the whole row
   * rather than per chip group. */
  countLabel?: string;
}

/**
 * The active deep-link filters, shown as removable chips so a page reached
 * from the Metadata queue says what it is filtered on. The whole chip is the
 * remove button: the filter has no other state to toggle, and a separate ×
 * hit-zone at this size is a misclick trap.
 *
 * Two tones, and the split is what the filter is *about*. Browsing a decade or
 * a family narrows a list and wears the accent. Arriving from the Metadata page
 * is a correction — the list is exactly the set of holes that page counted — and
 * wears amber, the one colour this app uses for a hole, from the lit cells of
 * the inspection table to the album's own dots.
 *
 * The chips did briefly go all-accent, on the reasoning that a filtered list is
 * a filtered list whichever door opened it. That was the wrong lesson from the
 * right complaint: what made the app punitive was scoring music nobody asked it
 * to score, not naming a problem on a page you opened by clicking the problem.
 */
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
