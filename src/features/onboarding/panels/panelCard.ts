/**
 * The plane a step's panel sits on, shared by the three of them.
 *
 * A real border rather than the app's `shadow-sm`: each panel is mounted
 * inside the step's collapsing wrapper, which clips at exactly the panel's own
 * width and height. The elevation shadow draws its hairline *outside* the box,
 * so three of its four sides were being cut off — a card with a top edge and
 * nothing else, which is what the night made impossible to miss. The border
 * lives inside the box and survives the clip, in the same colour the shadow's
 * edge would have used.
 */
export const PANEL_CARD = "flex flex-col rounded-2xl border border-elevation-edge bg-surface p-4";
