/**
 * The grid every track table shares. Headers and cells share `PAD`; words
 * align left, quantities right. The reading tables' "#" is centred because
 * it holds the play control; alignment for numbers comes from `SortableColumn`.
 */

/** Column headers; padding comes from `PAD`. */
export const HEADER = "pb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted";

/** Horizontal padding for header and body alike; also the 24px column gutter. */
export const PAD = "px-3";

/** Equal-width figures. Add `text-right` or `align="right"` on a sortable header. */
export const NUMERIC = "tabular-nums";
