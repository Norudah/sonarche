/** The play and edit buttons on card artwork, shared by the album and artist
 * shelves so they match. Shape and tone only; each card animates its own. */

/** On smoked glass over the artwork. */
export const CARD_ACTION_SECONDARY =
  "flex size-9 cursor-pointer items-center justify-center rounded-full bg-scrim text-on-scrim/90 shadow-md " +
  "backdrop-blur-sm outline-none hover:bg-scrim-strong hover:text-on-scrim focus-visible:ring-2 focus-visible:ring-accent";

/** Larger, so the eye lands on it. */
export const CARD_ACTION_PLAY =
  "flex size-10 cursor-pointer items-center justify-center rounded-full bg-accent-fill text-accent-foreground " +
  "glow-accent outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** The same pair on a row: no glass, one size smaller. */
const ROW_ACTION =
  "flex size-8 cursor-pointer items-center justify-center rounded-full outline-none " +
  "focus-visible:ring-2 focus-visible:ring-accent ";

export const ROW_ACTION_SECONDARY = ROW_ACTION + "text-muted hover:bg-default hover:text-foreground";

export const ROW_ACTION_PLAY =
  ROW_ACTION + "bg-accent-fill text-accent-foreground glow-accent hover:scale-[1.06] transition";
