/**
 * Outlined pill shared by the library's detail actions — the album hero's action
 * row and the metadata drawer's per-track re-match. Same height and radius as the
 * hero play button, so a pill reads as part of that control group wherever it
 * lands rather than reinventing itself per surface.
 *
 * Padding lives on the variants, not the base: Tailwind resolves class conflicts
 * by stylesheet order, so a `px-0` appended after `px-4` at a call site would not
 * win. Composing the padding in here keeps each variant unambiguous.
 */
export const HERO_PILL =
  "flex h-10 items-center gap-2 rounded-full border border-separator bg-surface/70 text-sm font-medium text-foreground outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/40";

export const HERO_PILL_SECONDARY = `${HERO_PILL} px-4`;
export const HERO_PILL_ICON = `${HERO_PILL} w-10 justify-center`;
