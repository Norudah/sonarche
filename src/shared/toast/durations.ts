/**
 * How long a toast stays, by what it asks of the reader.
 *
 * Four numbers rather than one because a toast's life should be set by what it
 * costs to miss it, not by taste. They live together so the register can be
 * read at a glance and so two features cannot drift into disagreeing about how
 * long "a moment" is.
 *
 * Nothing here is a floor for *reading*: the countdown pauses while the pointer
 * is over the toast, so a slow reader always gets as long as they want. These
 * are the durations for a reader who is looking somewhere else.
 */

/**
 * A message you only have to notice — "Ajouté à « X »". HeroUI's own default,
 * named so a call site can say it means this rather than say nothing.
 */
export const TOAST_GLANCE = 4_000;

/**
 * Two lines instead of one — a failure with its reason under it, or a report
 * with a caveat ("trois y étaient déjà"). Twice the reading, and none of it
 * expected.
 */
export const TOAST_EXPLAINED = 8_000;

/**
 * Carries a way back. The sentence has to be read *and* a decision made, and
 * the offer dies with the toast — so it is the longest of the reports.
 */
export const TOAST_UNDO = 10_000;

/**
 * An offer rather than a report: nothing has happened, and nothing is lost by
 * letting it go — the same thing can be had again from Settings. Long, because
 * it arrives while the reader is busy with something else.
 */
export const TOAST_OFFER = 15_000;
