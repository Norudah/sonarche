import { artistInitial } from "@/features/library/artists/artists";

interface ArtistAvatarProps {
  /** The artist's name — its first letter is the stand-in. */
  name: string;
  /** A user-chosen picture; when set, it replaces the initial. */
  imageUrl?: string | null;
  /** Sizing + any ring/shadow — the disc fills whatever box it is given. */
  className?: string;
}

/**
 * The artist's disc: their own picture when they have one, their initial
 * otherwise.
 *
 * A circle is the universal "person" mark against the square "release" cover,
 * so the artists shelf stops reading as the albums shelf a second time. The
 * stand-in used to be a line-art motif of the artist's genre — a whole drawing
 * system that mostly said "no photo" in a complicated way. An initial says the
 * same thing plainly, tells artists apart at a glance, and reads as a slot
 * waiting for the real picture rather than as art the app is attached to; the
 * image modal's copy makes the invitation explicit.
 *
 * SVG text on a 0–100 viewBox rather than styled markup, so the letter scales
 * with the disc from the 36px sticky-bar thumb to the 192px hero without a
 * size variant. Colour rides the `.artist-avatar` tokens in theme.css.
 */
export function ArtistAvatar({ name, imageUrl, className = "" }: ArtistAvatarProps) {
  return (
    <div
      className={`artist-avatar flex items-center justify-center overflow-hidden rounded-full ${className}`}
      aria-hidden
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <svg viewBox="0 0 100 100" className="size-full" role="none">
          <text
            x="50"
            y="54"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="44"
            fontWeight="600"
            fill="currentColor"
          >
            {artistInitial(name)}
          </text>
        </svg>
      )}
    </div>
  );
}
