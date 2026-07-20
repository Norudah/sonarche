import { Disc } from "lucide-react";

interface ArtistMosaicProps {
  artUrls: string[];
  className: string;
  /** Same contract as `AlbumCover`: `lazy` for the ones that live in a grid. */
  loading?: "lazy" | "eager";
}

/**
 * How each tile is placed in the 2×2 track so the covers always fill the frame,
 * however many there are. One runs full bleed, two split it down the middle,
 * three give the newest a full-height column beside a stacked pair, four tile
 * evenly. Anything beyond four never reaches here — see `mosaicCovers`.
 */
const LAYOUTS: Record<number, string[]> = {
  1: ["col-span-2 row-span-2"],
  2: ["row-span-2", "row-span-2"],
  3: ["row-span-2", "", ""],
  4: ["", "", "", ""],
};

/**
 * An artist's stand-in: their covers, inset as a mosaic in a frame.
 *
 * The frame is the whole point. We have no artist photos — beets stores none —
 * so the thumbnail has to be built from the discography, and the first version
 * simply showed the newest cover full bleed. That read as an *album*: a cover
 * running edge to edge is the album card's signature, so browsing artists felt
 * like browsing albums a second time. Insetting the artwork on a ground changes
 * the silhouette, and the silhouette is what you actually read when scanning a
 * grid at speed — one record versus a shelf of them.
 *
 * The tiling adapts to how many covers there are; the frame does not. A fixed
 * 2×2 with empty slots was tried first and is what the frame exists to avoid:
 * in a library where most artists have a single album, three quarters of every
 * tile came out blank and the whole grid read as a loading skeleton. The
 * constant here is the frame, which is what carries the "artist" reading; the
 * mosaic inside it just has to fill.
 *
 * The mount is the same near-white ground everywhere, including on the dark
 * hero band, where it reads as a physical frame. A translucent dark variant was
 * tried there and swallowed its own contents: a dark cover on a faintly lit
 * mount over a dark scrim is three shades of the same thing. A token that
 * changes appearance with its background has stopped being a token.
 *
 * Padding, gaps and radii are percentages so the same component holds from the
 * 36px sticky-bar thumbnail to the 160px hero without a size variant.
 */
export function ArtistMosaic({ artUrls, className, loading = "eager" }: ArtistMosaicProps) {
  if (artUrls.length === 0) {
    return (
      <div className={`${className} bg-surface-secondary flex items-center justify-center`}>
        <Disc className="size-1/3 text-muted" />
      </div>
    );
  }

  const layout = LAYOUTS[artUrls.length];

  return (
    // A generous mount, not a hairline: at 6% the single-album case came back to
    // within a whisker of an album card, which is the entire thing this
    // component exists to avoid. The visible ground has to survive a glance.
    <div
      className={`${className} bg-surface-secondary grid grid-cols-2 grid-rows-2 gap-[5%] p-[11%]`}
    >
      {artUrls.map((artUrl, index) => (
        <img
          key={artUrl}
          src={artUrl}
          alt=""
          loading={loading}
          // Decoding off the main thread: a grid scrolling past dozens of
          // mosaics is up to four times the images an album shelf has to chew on.
          decoding="async"
          className={`size-full rounded-[8%] object-cover ${layout[index]}`}
        />
      ))}
    </div>
  );
}
