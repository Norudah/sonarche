const FREE_TONE = "color-mix(in oklab, var(--color-muted) 40%, transparent)";

/**
 * Fixed identity tone per taxonomy category, same doctrine as the family
 * tones: the known set is closed and curated, so a pre-decided colour is an
 * identity rather than a rank. The values live in theme.css with the rest of
 * the visual identity. A free value the map does not know falls back to the
 * same grey the `Other` family uses.
 */
const CATEGORY_TONES: Record<string, string> = {
  Music: "var(--category-music)",
  "Video Games": "var(--category-video-games)",
  Film: "var(--category-film)",
  Series: "var(--category-series)",
  /** Retired alias of "Series" — see `useCategoryLabel`. */
  TV: "var(--category-series)",
  Anime: "var(--category-anime)",
  Cartoon: "var(--category-cartoon)",
  Musical: "var(--category-musical)",
};

export function toneOf(category: string): string {
  return CATEGORY_TONES[category] ?? FREE_TONE;
}
