import { CATEGORY_TAXONOMY } from "@/features/library/categories/categories";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";

const CHIP =
  "cursor-pointer rounded-full px-2.5 py-1 text-[0.75rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40";
const CHIP_ON = "bg-accent text-accent-foreground";
const CHIP_OFF = "bg-surface text-muted hover:bg-surface-tertiary hover:text-foreground";

/** Category picker for downloads and imports. "None" is its own chip. Lives
 * here so both callers share it. */
export function CategoryChoice({
  value,
  label,
  hint,
  noneLabel,
  isDisabled = false,
  onChange,
}: {
  value: string | null;
  label: string;
  hint: string;
  noneLabel: string;
  /** Locked once it can no longer change anything (import running). */
  isDisabled?: boolean;
  onChange: (next: string | null) => void;
}) {
  const labelOf = useCategoryLabel();

  return (
    <fieldset disabled={isDisabled} className="flex flex-col gap-2.5 disabled:opacity-50">
      <div className="flex flex-col gap-0.5">
        <legend className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">{label}</legend>
        <p className="max-w-prose text-xs leading-relaxed text-muted">{hint}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_TAXONOMY.map((canonical) => (
          <button
            key={canonical}
            type="button"
            aria-pressed={value === canonical}
            onClick={() => onChange(canonical)}
            className={`${CHIP} ${value === canonical ? CHIP_ON : CHIP_OFF} disabled:cursor-not-allowed`}
          >
            {labelOf(canonical)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
          className={`${CHIP} ${value === null ? CHIP_ON : CHIP_OFF} disabled:cursor-not-allowed`}
        >
          {noneLabel}
        </button>
      </div>
    </fieldset>
  );
}
