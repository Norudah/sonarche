/** Outlined button for library actions. Rectangular: round is reserved for
 * playback. Padding is on the variants so it isn't overridden unreliably. */
export const HERO_BUTTON =
  "flex h-10 items-center gap-2 rounded-xl border border-separator bg-surface/70 text-sm font-medium text-foreground outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/40";

export const HERO_BUTTON_SECONDARY = `${HERO_BUTTON} px-4`;
export const HERO_BUTTON_ICON = `${HERO_BUTTON} w-10 justify-center`;
