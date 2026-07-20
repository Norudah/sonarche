import { Disc } from "lucide-react";

interface AlbumCoverProps {
  artUrl: string | null;
  className: string;
  /**
   * `lazy` for covers that live in a list — the browser then fetches only what
   * is near the viewport instead of every cover at once. Defaults to `eager`
   * because the other call sites (hero, sticky header) show a single cover that
   * is on screen immediately, and deferring those would only add a flash.
   */
  loading?: "lazy" | "eager";
}

/**
 * Square artwork slot with the library's fallback. Shared by the grid card and
 * the album hero, which need the same missing-cover treatment at two sizes —
 * hence the `className` passthrough rather than a size prop.
 */
export function AlbumCover({ artUrl, className, loading = "eager" }: AlbumCoverProps) {
  if (artUrl) {
    return (
      <img
        src={artUrl}
        alt=""
        loading={loading}
        // Decoding off the main thread: a grid scrolling past dozens of covers
        // must not stutter while each one is turned into pixels.
        decoding="async"
        className={`${className} object-cover`}
      />
    );
  }
  return (
    <div className={`${className} flex items-center justify-center bg-default/60`}>
      <Disc className="size-1/4 text-muted" />
    </div>
  );
}
