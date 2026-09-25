import { ImagePlus } from "lucide-react";

import { ArtistAvatar } from "@/features/library/artists/ArtistAvatar";

/** A compact artist disc opening the image modal, used in the editors. */
export function ArtistImageButton({
  imageUrl,
  label,
  onClick,
  className = "size-8",
}: {
  imageUrl: string | null;
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
      <ArtistAvatar imageUrl={imageUrl} className="size-full" />
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <ImagePlus className="size-3.5 text-white" />
      </span>
    </button>
  );
}
