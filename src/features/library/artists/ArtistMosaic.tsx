import { Disc } from "lucide-react";

interface ArtistMosaicProps {
  artUrls: string[];
  className: string;
  /** Same contract as `AlbumCover`: `lazy` for the ones that live in a grid. */
  loading?: "lazy" | "eager";
}

/**
 * An artist's stand-in, made of their own covers. We have no artist photos —
 * beets stores none — so rather than invent a gradient avatar that carries no
 * information, the thumbnail is the discography itself.
 *
 * Square and `rounded-xl`, deliberately not a circle: a circle is the convention
 * for a *photograph*, and it would crop the corner off all four covers. Square
 * also makes this grid rhyme with the album shelf, which is the point — one
 * grammar for browsing a collection, not two.
 *
 * Four tiles or one, never three-and-a-gap: a partial 2×2 reads as a broken
 * layout, so anything short of four distinct covers shows the newest one full
 * bleed instead.
 */
export function ArtistMosaic({ artUrls, className, loading = "eager" }: ArtistMosaicProps) {
  if (artUrls.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center bg-default/60`}>
        <Disc className="size-1/4 text-muted" />
      </div>
    );
  }

  if (artUrls.length < 4) {
    return (
      <img
        src={artUrls[0]}
        alt=""
        loading={loading}
        decoding="async"
        className={`${className} object-cover`}
      />
    );
  }

  return (
    // `gap-px` on the same ground as the page: the hairline between tiles is the
    // background showing through, so it needs no border and costs no layer.
    <div className={`${className} grid grid-cols-2 grid-rows-2 gap-px bg-separator/40`}>
      {artUrls.map((artUrl) => (
        <img
          key={artUrl}
          src={artUrl}
          alt=""
          loading={loading}
          // Decoding off the main thread: a grid scrolling past dozens of
          // mosaics is four times the images an album shelf has to chew on.
          decoding="async"
          className="size-full object-cover"
        />
      ))}
    </div>
  );
}
