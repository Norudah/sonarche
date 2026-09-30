import { Music } from "lucide-react";

/** A track's artwork at list scale, with the missing-cover fallback. */
export function TrackThumb({
  artUrl,
  size = "size-10",
  radius = "rounded-md",
  /** `eager` only for a cover visible immediately. */
  loading = "lazy",
}: {
  artUrl: string | null | undefined;
  size?: string;
  radius?: string;
  loading?: "lazy" | "eager";
}) {
  if (artUrl) {
    return (
      <img
        src={artUrl}
        alt=""
        loading={loading}
        decoding="async"
        className={`${size} ${radius} shrink-0 object-cover`}
      />
    );
  }
  return (
    <div className={`${size} ${radius} flex shrink-0 items-center justify-center bg-default/60`}>
      <Music className="size-2/5 text-muted" />
    </div>
  );
}
