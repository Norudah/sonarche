import { useState, type CSSProperties } from "react";

import type { Artist } from "@/features/library/artists/artists";
import { ArtistCard } from "@/features/library/artists/ArtistCard";
import { ArtistImageModal } from "@/features/library/artists/ArtistImageModal";
import { ArtistRows } from "@/features/library/artists/ArtistRows";
import { useArtistImages } from "@/features/library/hooks";
import type { ShelfLayout } from "@/features/library/shelfLayout";

/** See `AlbumGrid`. */
const CASCADE_CAP = 24;

interface ArtistShelfProps {
  artists: Artist[];
  /** See `AlbumGrid`. */
  animationKey?: string;
  /** See `AlbumShelf`. */
  layout?: ShelfLayout;
  onPlay: (artist: Artist) => void;
}

/** Not virtualised (never more artists than albums). Hosts one image modal
 * for all cards. */
export function ArtistShelf({ artists, animationKey = "", layout = "grid", onPlay }: ArtistShelfProps) {
  const [editing, setEditing] = useState<Artist | null>(null);
  const artistImages = useArtistImages();

  return (
    <>
      {layout === "list" ? (
        <ArtistRows artists={artists} animationKey={animationKey} onPlay={onPlay} onEditImage={setEditing} />
      ) : (
        <div key={animationKey} className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-5 gap-y-7">
          {artists.map((artist, position) => (
            <ArtistCard
              key={artist.name}
              artist={artist}
              // Capped, like the album grid.
              style={{ "--row-stagger": `${Math.min(position, 10) * 0.025}s` } as CSSProperties}
              cascade={position < CASCADE_CAP}
              onPlay={() => onPlay(artist)}
              onEditImage={() => setEditing(artist)}
            />
          ))}
        </div>
      )}

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
