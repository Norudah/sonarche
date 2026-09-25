import { MicVocal } from "lucide-react";

interface ArtistAvatarProps {
  /** A user-chosen picture, replacing the placeholder. */
  imageUrl?: string | null;
  /** Size and any ring/shadow; the disc fills the box. */
  className?: string;
}

/** The artist's disc: their picture, else a microphone. Round so artists
 * don't read as albums. The icon is sized in percent to scale with the disc;
 * colours come from `.artist-avatar` in theme.css. */
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
