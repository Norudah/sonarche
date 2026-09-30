import { Disc } from "lucide-react";

interface AlbumCoverProps {
  artUrl: string | null;
  className: string;
  /** `lazy` inside lists; `eager` (default) for covers visible immediately. */
  loading?: "lazy" | "eager";
}

/** Square artwork with the missing-cover fallback, sized by `className`. */
export function AlbumCover({ artUrl, className, loading = "eager" }: AlbumCoverProps) {
  if (artUrl) {
    return <img src={artUrl} alt="" loading={loading} decoding="async" className={`${className} object-cover`} />;
  }
  return (
    <div className={`${className} flex items-center justify-center bg-default/60`}>
      <Disc className="size-1/4 text-muted" />
    </div>
  );
}
