import { FAMILY_NONE } from "@/features/library/genres/genres";

const OTHER_TONE = "color-mix(in oklab, var(--color-muted) 40%, transparent)";

/**
 * Fixed identity tone per browse family, keyed on the sidecar's display names.
 *
 * This used to be one hue ramped by rank, because the page was a distribution
 * and colour doubled as the ranking. The page is now an index of cards, and a
 * rank-derived colour is the wrong thing for an index: Pop would change shade
 * the day Rock overtakes it, and a colour that moves is not an identity. The
 * family set is closed and curated (the 13 roots of the sidecar's genre tree),
 * which is what makes a pre-decided colour per family legitimate — the values
 * live in theme.css next to the rest of the visual identity.
 *
 * A family key the map does not know (a future tree root the front has not
 * caught up with) falls back to the `Other` grey rather than crashing into an
 * unstyled card.
 */
const FAMILY_TONES: Record<string, string> = {
  Pop: "var(--family-pop)",
  Rock: "var(--family-rock)",
  Metal: "var(--family-metal)",
  Electronic: "var(--family-electronic)",
  "Hip-Hop": "var(--family-hip-hop)",
  "R&B, Soul & Funk": "var(--family-rnb)",
  Jazz: "var(--family-jazz)",
  Blues: "var(--family-blues)",
  "Folk & Country": "var(--family-folk-country)",
  Classical: "var(--family-classical)",
  Reggae: "var(--family-reggae)",
  Latin: "var(--family-latin)",
  World: "var(--family-world)",
};

/**
 * Two families step out of the palette and both earn it: `Other` is grey
 * because it is a leftover bucket rather than a small family, and `None` is
 * the app's amber — the colour that already means "metadata missing"
 * everywhere else.
 */
export function toneOf(family: string): string {
  if (family === FAMILY_NONE) return "var(--color-warning)";
  return FAMILY_TONES[family] ?? OTHER_TONE;
}
