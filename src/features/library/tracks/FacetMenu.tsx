import { Dropdown } from "@heroui/react";
import { Check, ChevronDown } from "lucide-react";

import { barPill } from "@/features/library/barPill";
import type { FacetOption } from "@/features/library/tracks/facets";

/** Can't collide with a real value (family or category keys). */
const ALL = "__all__";

interface FacetMenuProps {
  /** Shown while nothing is selected. */
  label: string;
  /** The clearing entry. */
  allLabel: string;
  options: FacetOption<string>[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Stored English keys are translated by the caller. */
  labelOf: (value: string) => string;
}

/** A browsing axis as a pill menu, hidden below two options. A Dropdown (see
 * `SortSelect`); the selected value replaces the axis name in the trigger. */
export function FacetMenu({ label, allLabel, options, value, onChange, labelOf }: FacetMenuProps) {
  if (options.length < 2) return null;

  const isActive = value != null;

  return (
    <Dropdown>
      <Dropdown.Trigger className={barPill(isActive)}>
        {isActive ? labelOf(value) : <span className="text-muted">{label}</span>}
        <ChevronDown className={"size-3.5 " + (isActive ? "opacity-70" : "text-muted")} />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom start">
        <Dropdown.Menu
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[value ?? ALL]}
          onSelectionChange={(keys) => {
            const [next] = Array.from(keys as Set<string>);
            if (next) onChange(next === ALL ? null : next);
          }}
        >
          <Dropdown.Item id={ALL} textValue={allLabel}>
            <span className="flex w-4 shrink-0 justify-center">{value == null && <Check className="size-3.5" />}</span>
            {allLabel}
          </Dropdown.Item>
          {options.map((option) => (
            <Dropdown.Item key={option.value} id={option.value} textValue={labelOf(option.value)}>
              {/* Our own check (see `SortSelect`); fixed width. */}
              <span className="flex w-4 shrink-0 justify-center">
                {option.value === value && <Check className="size-3.5" />}
              </span>
              <span className="flex-1">{labelOf(option.value)}</span>
              <span className="ml-3 text-muted tabular-nums">{option.trackCount}</span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
