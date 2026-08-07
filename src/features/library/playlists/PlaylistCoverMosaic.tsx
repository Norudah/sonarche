import { ListMusic } from "lucide-react";

interface PlaylistCoverMosaicProps {
  /** Up to four distinct cover URLs, playing order — see `playlistCovers`. */
  covers: string[];
  className: string;
}

/**
 * The tile a playlist wears: a 2×2 mosaic of its first four distinct sleeves.
 *
 * Four or nothing for the grid — a 2×2 with holes reads as broken images, so
 * below four the first cover stands alone, which is what a young playlist
 * honestly looks like. No artwork at all falls back to the same recessed slot
 * as a coverless album, with the playlist glyph instead of the disc so the two
 * shelves stay tellable apart at a glance.
 */
export function PlaylistCoverMosaic({ covers, className }: PlaylistCoverMosaicProps) {
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
