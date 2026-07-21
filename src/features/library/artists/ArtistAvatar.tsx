import { ARTIST_AVATAR_STYLE, type ArtStyle, genreArt } from "@/features/library/artists/genreArt";

interface ArtistAvatarProps {
  /** Browse family key (`artist.family`) — picks the motif. */
  family: string;
  /** Sizing + any ring/shadow — the disc fills whatever box it is given. */
  className?: string;
  /** Override the active set, for side-by-side previews. Defaults to the app's. */
  style?: ArtStyle;
}

/**
 * The artist's stand-in until (if ever) we fetch a real photo — a line-art
 * motif of their genre on a coloured disc.
 *
 * A circle is the universal "person" mark against the square "release" cover,
 * so the artists shelf stops reading as the albums shelf a second time; the
 * genre motif then tells one artist from another without any real photo. The
 * drawing lives in `genreArt`, keyed by `family`; this component only owns the
 * frame and the stroke defaults every motif inherits.
 *
 * Colour is entirely token-driven (`.artist-avatar` in theme.css): the ink is
 * `currentColor`, accents read `--artist-avatar-accent`. The motif rides a
 * 0–100 SVG viewBox, so it scales with the disc from the 36px sticky-bar thumb
 * to the 192px hero without a size variant.
 */
export function ArtistAvatar({ family, className = "", style = ARTIST_AVATAR_STYLE }: ArtistAvatarProps) {
  return (
    <div
      className={`artist-avatar flex items-center justify-center overflow-hidden rounded-full ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" className="size-full" role="none">
        <g fill="none" stroke="currentColor" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round">
          {genreArt(family, style)}
        </g>
      </svg>
    </div>
  );
}
