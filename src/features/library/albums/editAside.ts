/**
 * The card shell of the album drawer's side panel.
 *
 * Opaque, not the tinted wash the in-flow cards used: out here a card floats
 * over the drawer's dimmed backdrop, and a translucent fill let that darkness
 * through until the panel read as part of the page behind it rather than as
 * something on top. The shadow is what states it is floating.
 *
 * Its own module so both cards can wear it without `AlbumArtistPropagation`
 * having to import from the panel that imports it.
 */
export const EDIT_ASIDE_CARD =
  "flex flex-col gap-3 rounded-2xl border border-separator bg-surface p-4 shadow-xl shadow-black/10";
