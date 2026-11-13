/** Outlined button for library actions. Labelled ones are rectangular (round
 * is reserved for playback); the icon-only one is round like every icon
 * button. Same `--border` edge as HeroUI's secondary. Padding is on the
 * variants so it isn't overridden unreliably. */
const HERO_BUTTON =
  "flex h-10 items-center gap-2 border border-border bg-surface/70 text-sm font-medium text-foreground outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent";

export const HERO_BUTTON_SECONDARY = `${HERO_BUTTON} rounded-xl px-4`;
export const HERO_BUTTON_ICON = `${HERO_BUTTON} w-10 justify-center rounded-full`;
