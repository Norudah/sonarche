import { FAMILY_NONE } from "@/features/library/genres/genres";

const OTHER_TONE = "color-mix(in oklab, var(--color-muted) 40%, transparent)";

/** Fixed tone per family (theme.css): a closed set, so colour is identity,
 * not rank. Unknown keys fall back to the `Other` grey. */
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

/** `Other` is grey (a leftover bucket); `None` is amber (missing metadata). */
export function toneOf(family: string): string {
  if (family === FAMILY_NONE) return "var(--color-warning)";
  return FAMILY_TONES[family] ?? OTHER_TONE;
}
