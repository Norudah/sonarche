import { ImagePlus } from "lucide-react";

import { ArtistAvatar } from "@/features/library/artists/ArtistAvatar";

/**
 * The artist's disc as a way to their image — the compact affordance the
 * editors wear (track drawer, album panel), same hover grammar as the cover
 * buttons beside it. The full-size disc on the artist hero keeps its own
 * wiring; this is for the places where the artist is context, not subject.
 */
export function ArtistImageButton({
  family,
  imageUrl,
  label,
  onClick,
  className = "size-8",
}: {
  family: string;
  imageUrl: string | null;
  /** Accessible name — the artist image modal's own title reads well. */
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`group relative shrink-0 cursor-pointer overflow-hidden rounded-full outline-none ring-1 ring-separator/60 focus-visible:ring-2 focus-visible:ring-accent/60 ${className}`}
    >
      <ArtistAvatar family={family} imageUrl={imageUrl} className="size-full" />
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <ImagePlus className="size-3.5 text-white" />
      </span>
    </button>
  );
}
