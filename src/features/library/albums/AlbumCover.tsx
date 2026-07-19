import { Disc } from "lucide-react";

/**
 * Square artwork slot with the library's fallback. Shared by the grid card and
 * the album hero, which need the same missing-cover treatment at two sizes —
 * hence the `className` passthrough rather than a size prop.
 */
export function AlbumCover({ artUrl, className }: { artUrl: string | null; className: string }) {
  if (artUrl) {
    return <img src={artUrl} alt="" className={`${className} object-cover`} />;
  }
  return (
    <div className={`${className} flex items-center justify-center bg-default/60`}>
      <Disc className="size-1/4 text-muted" />
    </div>
  );
}
