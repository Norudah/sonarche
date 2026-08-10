import { CATEGORY_TAXONOMY } from "@/features/library/categories/categories";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";

const CHIP =
  "cursor-pointer rounded-full px-2.5 py-1 text-[0.75rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40";
const CHIP_ON = "bg-accent text-accent-foreground";
const CHIP_OFF = "bg-surface text-muted hover:bg-surface-tertiary hover:text-foreground";

/**
 * The context axis, chosen before music arrives rather than corrected after it.
 *
 * "None" is a chip of its own rather than un-picking the active one: leaving the
 * axis blank is a real answer — it is what the app did until categories existed
 * — and a choice you can only express by clicking the same thing twice is a
 * choice nobody finds.
 *
 * In `library/categories` and not in either caller: both ways music enters the
 * ark ask this same question, and asking it twice in two dialects would make one
 * axis look like two.
 */
export function CategoryChoice({
  value,
  label,
  hint,
  noneLabel,
  onChange,
}: {
  value: string | null;
  label: string;
  hint: string;
  noneLabel: string;
  onChange: (next: string | null) => void;
}) {
  const labelOf = useCategoryLabel();

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">{label}</legend>
      <p className="text-xs text-muted">{hint}</p>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_TAXONOMY.map((canonical) => (
          <button
            key={canonical}
            type="button"
            aria-pressed={value === canonical}
            onClick={() => onChange(canonical)}
            className={`${CHIP} ${value === canonical ? CHIP_ON : CHIP_OFF}`}
          >
            {labelOf(canonical)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
          className={`${CHIP} ${value === null ? CHIP_ON : CHIP_OFF}`}
        >
          {noneLabel}
        </button>
      </div>
    </fieldset>
  );
}
