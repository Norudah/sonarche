import { Heart, ListMusic } from "lucide-react";

interface PlaylistCoverMosaicProps {
  /** Up to four distinct cover URLs; see `playlistCovers`. */
  covers: string[];
  /** A user-chosen tile, preferred over the mosaic. */
  customUrl?: string | null;
  /** The heart tile of the built-in favorites list, over any image. */
  favorites?: boolean;
  className: string;
}

/** The user's image, else a 2×2 mosaic (or a single cover below four), else
 * the empty slot with the playlist glyph. */
export function PlaylistCoverMosaic({ covers, customUrl, favorites, className }: PlaylistCoverMosaicProps) {
  if (favorites) {
    return (
      <div className={`${className} flex items-center justify-center bg-accent-soft`}>
        <Heart className="size-1/3 fill-current text-accent" />
      </div>
    );
  }
  if (customUrl) {
    return <img src={customUrl} alt="" loading="lazy" decoding="async" className={`${className} object-cover`} />;
  }
  if (covers.length >= 4) {
    return (
      <div className={`${className} grid grid-cols-2 grid-rows-2`}>
        {covers.slice(0, 4).map((url) => (
          <img key={url} src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ))}
      </div>
    );
  }
  if (covers.length > 0) {
    return <img src={covers[0]} alt="" loading="lazy" decoding="async" className={`${className} object-cover`} />;
  }
  return (
    <div className={`${className} flex items-center justify-center bg-default/60`}>
      <ListMusic className="size-1/4 text-muted" />
    </div>
  );
}
