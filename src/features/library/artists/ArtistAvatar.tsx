import { MicVocal } from "lucide-react";

interface ArtistAvatarProps {
  /** A user-chosen picture; when set, it replaces the placeholder. */
  imageUrl?: string | null;
  /** Sizing + any ring/shadow — the disc fills whatever box it is given. */
  className?: string;
}

/**
 * The artist's disc: their own picture when they have one, a mic otherwise.
 *
 * A circle is the universal "person" mark against the square "release" cover,
 * so the artists shelf stops reading as the albums shelf a second time. The
 * stand-in has been through two lives already: line-art genre motifs (a whole
 * drawing system that said "no photo" in a complicated way), then the artist's
 * initial — which made the shelf read like a chat roster. One quiet vocal mic
 * for everyone says "performer, no picture yet" without pretending to be
 * identity; the image modal's copy makes the invitation to replace it
 * explicit.
 *
 * Percentage-sized icon so it scales with the disc from the 36px sticky-bar
 * thumb to the 192px hero without a size variant — lucide is vector, the
 * stroke follows. Colour rides the `.artist-avatar` tokens in theme.css.
 */
export function ArtistAvatar({ imageUrl, className = "" }: ArtistAvatarProps) {
  return (
    <div
      className={`artist-avatar flex items-center justify-center overflow-hidden rounded-full ${className}`}
      aria-hidden
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <MicVocal className="size-[42%] opacity-80" strokeWidth={1.75} />
      )}
    </div>
  );
}
