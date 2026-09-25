import type { CSSProperties } from "react";

import type { Album } from "@/features/library/albums/albums";
import { AlbumCard } from "@/features/library/albums/AlbumCard";

/** Cards in the entrance cascade (a couple of rows); animating all of them
 * froze integrated GPUs. */
const CASCADE_CAP = 24;

interface AlbumGridProps {
  albums: Album[];
  /** A change re-keys the grid and replays the cascade (as in `TrackTable`). */
  animationKey?: string;
  onPlay: (album: Album) => void;
  onEdit?: (album: Album) => void;
}

export function AlbumGrid({ albums, animationKey = "", onPlay, onEdit }: AlbumGridProps) {
  return (
    // auto-fill keeps the card size and reflows on wide windows.
    <div key={animationKey} className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-5 gap-y-7">
      {albums.map((album, position) => (
        <AlbumCard
          key={album.key}
          album={album}
          // Capped, like the track table.
          style={{ "--row-stagger": `${Math.min(position, 10) * 0.025}s` } as CSSProperties}
          cascade={position < CASCADE_CAP}
          onPlay={() => onPlay(album)}
          onEdit={onEdit && (() => onEdit(album))}
        />
      ))}
    </div>
  );
}
