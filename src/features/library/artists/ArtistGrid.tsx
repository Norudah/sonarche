import { useState, type CSSProperties } from "react";

import type { Artist } from "@/features/library/artists/artists";
import { ArtistCard } from "@/features/library/artists/ArtistCard";
import { ArtistImageModal } from "@/features/library/artists/ArtistImageModal";
import { useArtistImages } from "@/features/library/hooks";

interface ArtistGridProps {
  artists: Artist[];
  /** Same contract as `AlbumGrid`: what this result set is a result *of*.
   * A change re-keys the grid and replays the cascade. */
  animationKey?: string;
  onPlay: (artist: Artist) => void;
}

/**
 * Deliberately not virtualised, on the same reasoning as `AlbumGrid`: there can
 * never be more artists than albums, so the shelf that already holds ~900 cards
 * comfortably sets the ceiling for this one. Revisit past a few thousand.
 *
 * The image modal lives here, once, rather than once per card: the cards only
 * point at an artist, and a grid of hundreds must not mount hundreds of
 * dialogs to let each disc be dressed.
 */
export function ArtistGrid({ artists, animationKey = "", onPlay }: ArtistGridProps) {
  const [editing, setEditing] = useState<Artist | null>(null);
  const artistImages = useArtistImages();

  return (
    <>
      <div key={animationKey} className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-5 gap-y-7">
        {artists.map((artist, position) => (
          <ArtistCard
            key={artist.name}
            artist={artist}
            // Capped like the album grid's: the cards below the fold are not
            // worth making the user wait for.
            style={{ "--row-stagger": `${Math.min(position, 10) * 0.025}s` } as CSSProperties}
            onPlay={() => onPlay(artist)}
            onEditImage={() => setEditing(artist)}
          />
        ))}
      </div>

      {editing && (
        <ArtistImageModal
          artist={editing}
          imageUrl={artistImages.data?.get(editing.name) ?? null}
          isOpen
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
