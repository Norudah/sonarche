/**
 * The filter bar's control shape — every trigger in that row wears it.
 *
 * The row holds a mode switch, two facet menus, a filter panel and a search
 * field, all from different primitives (our own buttons, HeroUI's Dropdown and
 * Popover triggers). Without one shared shape they came out at three different
 * heights and two different radii, and the bar read as a pile of widgets rather
 * than one instrument. `SearchField` matches these dimensions by hand for the
 * same reason it is hand-rolled at all.
 *
 * Padding lives on the variants, not the base — Tailwind resolves conflicts by
 * stylesheet order, so a `px-` appended at a call site would not reliably win.
 */
const BAR_PILL_BASE =
  "flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full text-[0.8125rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/30";

/** Idle: the same recessed fill as the search field. */
const BAR_PILL = `${BAR_PILL_BASE} bg-surface-secondary px-3.5 text-foreground hover:bg-surface-tertiary data-[pressed]:bg-surface-tertiary`;

/**
 * Carrying a value. Soft accent rather than a filled pill: a set filter is a
 * state to notice, not an action to take, and five filled indigo pills in one
 * row would shout louder than the play buttons above them.
 */
const BAR_PILL_ACTIVE = `${BAR_PILL_BASE} bg-accent-soft px-3.5 font-medium text-accent hover:bg-accent-soft/80 data-[pressed]:bg-accent-soft/80`;

export function barPill(isActive: boolean): string {
  return isActive ? BAR_PILL_ACTIVE : BAR_PILL;
}
