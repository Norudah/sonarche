import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface TriageChip {
  key: string;
  label: string;
  /** "filter" (default) is any narrowed list; "review" is the one filter that
   * means the app may have written something wrong. */
  tone?: "filter" | "review";
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
 * The accent is the default, amber the exception. Every correction filter used
 * to arrive in amber, so landing on "tracks with no year" looked like landing
 * on an incident — for a list of files whose only sin is an empty tag. A
 * filtered list is a filtered list, whichever door opened it; only "match to
 * review" warns, because only there might the app have written the wrong thing.
 */
const CHIP_TONE = {
  filter: "bg-accent-soft text-accent",
  review: "bg-warning-soft text-warning",
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
