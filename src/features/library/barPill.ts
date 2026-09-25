/** Shared shape for every filter-bar control, whatever primitive renders it.
 * Padding is on the variants: appended classes don't reliably override. */
const BAR_PILL_BASE =
  "flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full text-[0.8125rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/30";

/** Idle. */
const BAR_PILL = `${BAR_PILL_BASE} bg-surface-secondary px-3.5 text-foreground hover:bg-surface-tertiary data-[pressed]:bg-surface-tertiary`;

/** Holding a value: soft accent, a state rather than an action. */
const BAR_PILL_ACTIVE = `${BAR_PILL_BASE} bg-accent-soft px-3.5 font-medium text-accent hover:bg-accent-soft/80 data-[pressed]:bg-accent-soft/80`;

export function barPill(isActive: boolean): string {
  return isActive ? BAR_PILL_ACTIVE : BAR_PILL;
}
