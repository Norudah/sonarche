/**
 * The grid every track table shares — the library's, the album's, the
 * playlist's, and the inspection one.
 *
 * They used to each declare their own header string. The four copies drifted:
 * the same "#" column was centred on three of them and right-aligned on the
 * fourth, and the inspection table dropped the uppercase its neighbours kept —
 * so turning the lens on changed the case, the size and the alignment of the
 * whole header row, on a table showing the very same tracks.
 *
 * Two rules hold the grid together:
 *
 *   1. A column's header and its cells carry the same horizontal padding.
 *      Nothing else keeps a label over its own values, and `PAD` exists so no
 *      table can pick one for its head and another for its body.
 *   2. Alignment follows the nature of the content, not the column: words left,
 *      quantities right. A number is read by its last digit, which is why it
 *      hugs the right edge.
 *
 * One column is centred, and it is not a counter-example: the reading tables'
 * "#" holds the play control, which happens to show the row's position at rest.
 * It is a target, not a figure. The inspection table's "N°" — the stored track
 * number, a real field being audited — is a quantity and goes right.
 *
 * Alignment is deliberately absent from `NUMERIC`: a sortable column states it
 * once, through `SortableColumn`'s `align`, which also decides the side its
 * arrow reserves.
 */

/** Column headers, everywhere. No padding of its own — see `PAD`. */
export const HEADER = "pb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted";

/**
 * The one horizontal padding of a track table, head and body alike.
 *
 * It is also the gutter: two neighbouring columns are 24px apart, everywhere.
 * The inspection table used to run on half that, which is why a right-aligned
 * year sat all but touching the genre next to it while a hand-span of nothing
 * opened on its other side.
 *
 * An extra `pr` on the numeric columns alone was tried and reverted: a 64px
 * column holding "ANNÉE" has 36px for a 42px label, so buying gutter out of the
 * padding pushed the very headers this pass is straightening back off their
 * values. A uniform gutter and columns wide enough for their own labels.
 */
export const PAD = "px-3";

/** A column of quantities: figures of equal width so the digits stack. Add
 * `text-right` — or `align="right"` on a sortable header. */
export const NUMERIC = "tabular-nums";
