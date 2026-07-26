/**
 * The tracklist's column track, shared by the header and every row so the two
 * can never drift apart.
 *
 * Six columns: the suggestion gutter, the number, then the three editable tags,
 * then the completion dot. The title gets the most room because it is the one a
 * user scans to find a row; the genre the least because its values are short.
 */
export const GRID = "grid grid-cols-[1.25rem_2.75rem_1.5fr_1.25fr_1fr_1.5rem] gap-x-2";
