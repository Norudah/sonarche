import { Dropdown } from "@heroui/react";
import { Check, ChevronDown } from "lucide-react";

import { barPill } from "@/features/library/barPill";
import type { FacetOption } from "@/features/library/tracks/facets";

/** Menu id for "no filter". A real value can never collide with it: the axes are
 * genre families and category tags, and neither is ever this. */
const ALL = "__all__";

interface FacetMenuProps {
  /** The axis, shown while nothing is selected ("Famille"). */
  label: string;
  /** The clearing entry ("Toutes les familles"). */
  allLabel: string;
  options: FacetOption<string>[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Stored value → display name. The two axes both store English keys that the
   * UI translates, so the menu cannot render its own options. */
  labelOf: (value: string) => string;
}

/**
 * One browsing axis as a pill menu.
 *
 * Hidden below two options: a menu whose only choice is the one thing already on
 * screen — the lone family of a single-artist page, the lone genre of a family
 * that has just one — is a control that cannot do anything, and four of those in
 * a row is how a filter bar starts feeling like a dashboard. The scope decides
 * which pills exist, so nothing has to be turned off page by page.
 *
 * Dropdown rather than Select, and for the reason `SortSelect` gives: Select owns
 * its trigger's field chrome, while Dropdown.Trigger is a bare button we can
 * shape into the bar's own pill. The selected value replaces the axis name in the
 * trigger, so an active filter states itself and needs no chip of its own.
 */
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
              {/* Ticked off our own state, not `Dropdown.ItemIndicator` — see
               * `SortSelect`: that slot renders unconditionally here and every
               * option came out checked. The width is held either way so the
               * labels do not shift when the selection moves. */}
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
