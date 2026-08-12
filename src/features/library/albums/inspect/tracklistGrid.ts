/**
 * The tracklist's column track, shared by the header and every row so the two
 * can never drift apart.
 *
 * Seven columns: the suggestion gutter, the number, then the four editable
 * tags, then the completion dot. The title gets the most room because it is the
 * one a user scans to find a row; the year is fixed because it is four digits.
 */
export const GRID = "grid grid-cols-[1.25rem_2.75rem_1.5fr_1.25fr_4.25rem_1fr_1.5rem] gap-x-2";
