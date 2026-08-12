/**
 * The two buttons that ride a card's artwork: play, and the one that dresses it.
 *
 * Shared because the album shelf and the artist shelf sit in the same grid, one
 * scroll apart, and had drifted to different sizes — a 40 px play disc on a
 * cover and a 44 px one on a monogram, with icons a step apart to match. Two
 * shelves of the same furniture must agree on that furniture's size, or hovering
 * across them feels like the page resizing under the pointer.
 *
 * Shape and tone only. How each card *reveals* the pair is its own business —
 * the album card lifts the row, the artist card scales each button on its disc —
 * and that difference is deliberate, so no transition is baked in here.
 */

/** Secondary, on smoked glass over the artwork: the pencil on an album, the
 * image pill on an artist. */
export const CARD_ACTION_SECONDARY =
  "flex size-9 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white/90 shadow-md " +
  "backdrop-blur-sm outline-none hover:bg-black/70 hover:text-white focus-visible:ring-2 focus-visible:ring-accent/40";

/** The play disc — accent, haloed, and the larger of the two so the eye lands
 * on it first. */
export const CARD_ACTION_PLAY =
  "flex size-10 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-foreground " +
  "glow-accent outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
