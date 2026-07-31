/**
 * Outlined button shared by the library's detail actions — the album hero's
 * action row (Inspecter, the overflow) and the re-match control in both
 * metadata drawers.
 *
 * Rectangular, and that is the point: everything wearing this acts on the
 * library rather than starting playback, which is the app's shape rule (see
 * HeroPlayButtons). It was `rounded-full` back when it was named `heroPill`,
 * deliberately matching the play control it sat beside — so re-matching an
 * album, opening a metadata drawer and shuffling a record all announced
 * themselves as the same kind of act. It now takes the same radius as the
 * app's other commits (Récupérer, Importer, Enregistrer), so a management
 * button reads the same wherever it lands.
 *
 * Padding lives on the variants, not the base: Tailwind resolves class
 * conflicts by stylesheet order, so a `px-0` appended after `px-4` at a call
 * site would not win. Composing the padding in here keeps each variant
 * unambiguous.
 */
export const HERO_BUTTON =
  "flex h-10 items-center gap-2 rounded-xl border border-separator bg-surface/70 text-sm font-medium text-foreground outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/40";

export const HERO_BUTTON_SECONDARY = `${HERO_BUTTON} px-4`;
export const HERO_BUTTON_ICON = `${HERO_BUTTON} w-10 justify-center`;
