import type { ReactNode } from "react";

/**
 * Genre avatars — one motif per browse family, drawn as line-art on a 0–100
 * viewBox so it scales with the disc like the frame around it.
 *
 * Two interchangeable sets. `figures` are simple caricatures of a genre's
 * performer (a top-hatted guitarist for metal, a sax player for jazz); `icons`
 * are the genre's instrument or symbol. Switching between them is a one-line
 * change to `ARTIST_AVATAR_STYLE` — both sets are always compiled, so flipping
 * costs nothing beyond the constant.
 *
 * Colour is never hard-coded: the primary ink is `currentColor` (inherited from
 * the wrapper, themed by `.artist-avatar`), and every accent stroke/fill reads
 * `--artist-avatar-accent`. Re-tinting the whole system — dropping the amber,
 * say — is one CSS variable, no path edited. Accent is used sparingly, only to
 * pick out one telling detail (a pickup, a mic ball, a hat band).
 */
export type ArtStyle = "figures" | "icons";

/** The active set. Flip to "icons" to swap every artist avatar at once. */
export const ARTIST_AVATAR_STYLE: ArtStyle = "figures";

const A = "var(--artist-avatar-accent)";

/** Head + shoulders shared by every figure; hats and hair layer on top. */
function Bust() {
  return (
    <>
      <circle cx="50" cy="35" r="12" />
      <path d="M27 75 C27 60 37 55 50 55 C63 55 73 60 73 75" />
    </>
  );
}

const FIGURES: Record<string, ReactNode> = {
  metal: (
    <>
      <path d="M37 28 C28 40 29 60 33 76" />
      <path d="M63 28 C72 40 71 60 67 76" />
      <path d="M37 28 C40 18 60 18 63 28" />
      <Bust />
    </>
  ),
  rock: (
    <>
      <path d="M39 30 C36 22 44 20 50 20 C56 20 64 22 61 30" />
      <Bust />
      <rect stroke={A} fill="none" x="39" y="32" width="9" height="6" rx="2" />
      <rect stroke={A} fill="none" x="52" y="32" width="9" height="6" rx="2" />
      <path stroke={A} d="M48 35 H52" />
    </>
  ),
  pop: (
    <>
      <path d="M38 34 L35 74" />
      <path d="M62 34 L65 74" />
      <path d="M38 32 C42 24 58 24 62 32" />
      <Bust />
      <rect fill={A} stroke="none" x="58" y="39" width="7" height="11" rx="3.5" />
      <path stroke={A} d="M61 50 L66 59" />
    </>
  ),
  electronic: (
    <>
      <Bust />
      <path d="M34 36 A17 15 0 0 1 66 36" />
      <rect x="30" y="36" width="7" height="12" rx="3" />
      <rect x="63" y="36" width="7" height="12" rx="3" />
    </>
  ),
  "hip hop": (
    <>
      <Bust />
      <path d="M37 30 C37 20 63 20 63 30" />
      <path d="M37 30 H62" />
      <path stroke={A} d="M62 30 L78 26" />
    </>
  ),
  jazz: (
    <>
      <Bust />
      <path d="M35 28 H65" />
      <path d="M41 28 C41 19 59 19 59 28" />
      <path d="M46 22 Q50 20 54 22" />
      <path stroke={A} d="M46 46 Q50 51 54 46" />
    </>
  ),
  blues: (
    <>
      <Bust />
      <path d="M30 29 H70" />
      <path d="M40 29 C40 19 60 19 60 29" />
      <path d="M45 24 Q50 21 55 24" />
      <rect stroke={A} fill="none" x="40" y="33" width="8" height="5" rx="2" />
      <rect stroke={A} fill="none" x="52" y="33" width="8" height="5" rx="2" />
      <path stroke={A} d="M48 35 H52" />
    </>
  ),
  "soul & funk": (
    <>
      <path d="M32 40 C27 20 44 15 50 15 C56 15 73 20 68 40" />
      <Bust />
    </>
  ),
  folk: (
    <>
      <Bust />
      <path d="M32 30 Q50 36 68 30" />
      <path d="M40 30 C40 20 60 20 60 30" />
      <path stroke={A} d="M40 44 C42 54 58 54 60 44" />
    </>
  ),
  country: (
    <>
      <Bust />
      <path d="M25 31 Q50 40 75 31" />
      <path d="M38 31 C38 19 44 17 50 17 C56 17 62 19 62 31" />
      <path d="M43 23 Q50 19 57 23" />
    </>
  ),
  reggae: (
    <>
      <path d="M35 36 C31 50 32 66 35 78" />
      <path d="M43 42 C41 56 41 68 43 78" />
      <path d="M65 36 C69 50 68 66 65 78" />
      <path d="M57 42 C59 56 59 68 57 78" />
      <Bust />
      <path d="M34 30 Q50 16 66 30" />
      <path d="M33 30 H67" />
      <circle fill={A} stroke="none" cx="50" cy="16" r="2.5" />
    </>
  ),
  latin: (
    <>
      <Bust />
      <path d="M18 33 Q50 43 82 33" />
      <path d="M40 33 C40 18 60 18 60 33" />
      <path d="M42 22 Q50 16 58 22" />
      <path stroke={A} d="M40 30 H60" />
    </>
  ),
  classical: (
    <>
      <path d="M38 32 C37 24 45 22 50 22 C55 22 63 24 62 32" />
      <path d="M50 22 V30" />
      <Bust />
      <path stroke={A} d="M44 57 L50 60 L44 63 Z" />
      <path stroke={A} d="M56 57 L50 60 L56 63 Z" />
    </>
  ),
  __fallback__: (
    <>
      <path d="M39 32 C41 25 59 25 61 32" />
      <Bust />
    </>
  ),
};

const ICONS: Record<string, ReactNode> = {
  metal: (
    <>
      <path d="M57 20 L50 44" />
      <path d="M49 16 L58 21" />
      <path stroke={A} d="M51 17 L54 15 M55 19 L58 17" />
      <path d="M50 44 L34 74 L48 66 L50 58 L52 66 L66 74 Z" />
      <path stroke={A} d="M45 60 H55" />
    </>
  ),
  rock: (
    <>
      <path d="M30 68 C22 60 28 48 40 50 C50 52 55 60 50 68 C46 76 36 76 30 68 Z" />
      <path d="M47 55 L78 28" />
      <path d="M76 26 L84 33" />
      <path stroke={A} d="M78 27 L81 25 M82 30 L85 28" />
      <path stroke={A} d="M35 62 L45 56" />
    </>
  ),
  pop: (
    <>
      <rect x="41" y="18" width="18" height="22" rx="9" />
      <path stroke={A} d="M45 25 H55 M45 30 H55" />
      <path d="M50 40 L50 66" />
      <path d="M45 66 H55" />
    </>
  ),
  electronic: (
    <>
      <rect x="24" y="52" width="52" height="20" rx="3" />
      <path d="M34 52 V72 M44 52 V72 M54 52 V72 M64 52 V72" />
      <circle stroke={A} cx="34" cy="38" r="6" />
      <circle stroke={A} cx="52" cy="38" r="6" />
      <path stroke={A} d="M34 38 V33 M52 38 V33" />
    </>
  ),
  "hip hop": (
    <>
      <rect x="20" y="38" width="60" height="34" rx="4" />
      <circle cx="35" cy="55" r="9" />
      <circle cx="65" cy="55" r="9" />
      <circle fill={A} stroke="none" cx="35" cy="55" r="2.5" />
      <circle fill={A} stroke="none" cx="65" cy="55" r="2.5" />
      <path d="M38 38 C38 30 62 30 62 38" />
      <path stroke={A} d="M46 45 H54" />
    </>
  ),
  jazz: (
    <>
      <path d="M58 18 L58 24" />
      <path d="M58 24 L58 52 C58 66 46 70 38 64" />
      <path d="M38 64 C32 68 31 74 37 76 L45 72" />
      <circle fill={A} stroke="none" cx="58" cy="34" r="2" />
      <circle fill={A} stroke="none" cx="58" cy="42" r="2" />
      <circle fill={A} stroke="none" cx="56" cy="50" r="2" />
    </>
  ),
  blues: (
    <>
      <rect x="24" y="42" width="52" height="16" rx="3" />
      <path d="M24 48 H76" />
      <path stroke={A} d="M33 42 V48 M41 42 V48 M49 42 V48 M57 42 V48 M65 42 V48" />
    </>
  ),
  "soul & funk": (
    <>
      <path d="M20 42 L32 46 V54 L20 58 Z" />
      <path d="M32 50 H66" />
      <path d="M66 50 C72 50 72 46 78 46" />
      <path stroke={A} d="M44 50 V40 M52 50 V40 M60 50 V40" />
      <circle fill={A} stroke="none" cx="44" cy="39" r="2" />
      <circle fill={A} stroke="none" cx="52" cy="39" r="2" />
      <circle fill={A} stroke="none" cx="60" cy="39" r="2" />
    </>
  ),
  folk: (
    <>
      <circle cx="44" cy="60" r="18" />
      <circle stroke={A} cx="44" cy="60" r="5" />
      <path stroke={A} d="M38 68 H50" />
      <path d="M54 50 L80 24" />
      <path d="M78 22 L86 28" />
    </>
  ),
  country: (
    <>
      <path d="M18 58 Q50 72 82 58" />
      <path d="M32 58 C32 36 68 36 68 58" />
      <path d="M40 44 Q50 38 60 44" />
      <path stroke={A} d="M33 53 Q50 59 67 53" />
    </>
  ),
  reggae: (
    <>
      <path d="M28 46 Q50 22 72 46" />
      <path d="M26 46 H74" />
      <circle fill={A} stroke="none" cx="50" cy="22" r="3" />
      <path d="M32 50 V76 M42 50 V80 M50 50 V76 M58 50 V80 M68 50 V76" />
    </>
  ),
  latin: (
    <>
      <circle cx="36" cy="38" r="11" />
      <path d="M34 48 L26 68" />
      <circle cx="64" cy="44" r="11" />
      <path d="M66 54 L74 72" />
      <circle fill={A} stroke="none" cx="36" cy="38" r="2.5" />
      <circle fill={A} stroke="none" cx="64" cy="44" r="2.5" />
    </>
  ),
  classical: (
    <>
      <path d="M28 72 V44 C28 34 40 30 52 30 C70 30 76 44 72 60 L70 72 Z" />
      <path d="M40 34 C58 34 66 44 66 58" />
      <rect stroke={A} x="30" y="66" width="38" height="7" rx="1" />
      <path stroke={A} d="M38 66 V73 M46 66 V73 M54 66 V73 M62 66 V73" />
    </>
  ),
  __fallback__: (
    <>
      <circle cx="50" cy="50" r="28" />
      <circle cx="50" cy="50" r="10" />
      <circle fill={A} stroke="none" cx="50" cy="50" r="3" />
      <path stroke={A} d="M64 34 A20 20 0 0 1 68 46" />
    </>
  ),
};

/** `artist.family` arrives as the sidecar's *display* label ("Metal",
 * "Electronic", "Hip-Hop", "Soul & Funk" — see genre_tree.py `_FAMILIES`), not
 * the lowercase tree root the keys above are written in. Normalising both sides
 * (case + separators folded away) lets "Hip-Hop" find "hip hop" and survives any
 * future re-casing of those labels, instead of silently falling back. */
function normKey(family: string): string {
  return family.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const BY_KEY: Record<ArtStyle, Map<string, ReactNode>> = {
  figures: new Map(Object.entries(FIGURES).map(([key, art]) => [normKey(key), art])),
  icons: new Map(Object.entries(ICONS).map(([key, art]) => [normKey(key), art])),
};

/** The motif for a family in the active (or given) set, falling back for the
 * two sentinels and any unknown key. */
export function genreArt(family: string, style: ArtStyle = ARTIST_AVATAR_STYLE): ReactNode {
  const map = BY_KEY[style];
  return map.get(normKey(family)) ?? map.get(normKey("__fallback__"))!;
}
