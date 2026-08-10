import type { CSSProperties } from "react";

import type { Album } from "@/features/library/albums/albums";
import { AlbumCard } from "@/features/library/albums/AlbumCard";

interface AlbumGridProps {
  albums: Album[];
  /** Same contract as `TrackTable`: what this result set is a result *of*.
   * A change re-keys the grid and replays the cascade. */
  animationKey?: string;
  onPlay: (album: Album) => void;
  onEdit?: (album: Album) => void;
}

export function AlbumGrid({ albums, animationKey = "", onPlay, onEdit }: AlbumGridProps) {
  return (
    // auto-fill over a fixed column count: the shelf keeps its card size and
    // reflows, instead of stretching four covers to fill an ultrawide window.
    <div key={animationKey} className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-5 gap-y-7">
      {albums.map((album, position) => (
        <AlbumCard
          key={album.key}
          album={album}
          // Capped like the track table's: the cards below the fold are not
          // worth making the user wait for.
          style={{ "--row-stagger": `${Math.min(position, 10) * 0.025}s` } as CSSProperties}
          onPlay={() => onPlay(album)}
          onEdit={onEdit && (() => onEdit(album))}
        />
      ))}
    </div>
  );
}
