import { ARTIST_AVATAR_STYLE, type ArtStyle, genreArt } from "@/features/library/artists/genreArt";

interface ArtistAvatarProps {
  /** Browse family key (`artist.family`) — picks the motif. */
  family: string;
  /** A user-chosen picture; when set, it replaces the generated motif. */
  imageUrl?: string | null;
  /** Sizing + any ring/shadow — the disc fills whatever box it is given. */
  className?: string;
  /** Override the active set, for side-by-side previews. Defaults to the app's. */
  style?: ArtStyle;
}

/**
 * The artist's disc: their own picture when they have one, a line-art motif of
 * their genre otherwise.
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
 * to the 192px hero without a size variant. A real image needs none of that:
 * it is a 500px square rendition, drawn cover-fit in the same circle.
 */
export function ArtistAvatar({ family, imageUrl, className = "", style = ARTIST_AVATAR_STYLE }: ArtistAvatarProps) {
  return (
    <div
      className={`artist-avatar flex items-center justify-center overflow-hidden rounded-full ${className}`}
      aria-hidden
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <svg viewBox="0 0 100 100" className="size-full" role="none">
          <g fill="none" stroke="currentColor" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round">
            {genreArt(family, style)}
          </g>
        </svg>
      )}
    </div>
  );
}
