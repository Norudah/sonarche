const FREE_TONE = "color-mix(in oklab, var(--color-muted) 40%, transparent)";

/** Fixed tone per taxonomy category (theme.css); unknown values get the `Other` grey. */
const CATEGORY_TONES: Record<string, string> = {
  Music: "var(--category-music)",
  "Video Games": "var(--category-video-games)",
  Film: "var(--category-film)",
  Series: "var(--category-series)",
  /** Retired alias of "Series". */
  TV: "var(--category-series)",
  Anime: "var(--category-anime)",
  Cartoon: "var(--category-cartoon)",
  Musical: "var(--category-musical)",
};

export function toneOf(category: string): string {
  return CATEGORY_TONES[category] ?? FREE_TONE;
}
