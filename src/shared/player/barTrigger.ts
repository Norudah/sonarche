/** The bar's icon triggers — queue, lyrics — as one class rather than a
 * component: HeroUI's `Popover.Trigger` renders the pressable itself, so what
 * these panels share is a look, not an element. */
export const BAR_TRIGGER =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted outline-none transition-colors hover:bg-default/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40 aria-expanded:bg-default/70 aria-expanded:text-foreground disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted";

/** A panel's little section title — "En lecture", "À suivre". */
export const PANEL_SECTION = "px-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted";
