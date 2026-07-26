import { Music } from "lucide-react";

/**
 * A track's artwork at list scale, with the app's one missing-cover fallback.
 *
 * Extracted once the tracklist, the player bar and the queue panel all needed
 * the same square: three surfaces hand-rolling the same `Music`-on-grey meant
 * three chances for them to drift apart. Lives in `shared` because the player
 * cannot import from `features`.
 */
export function TrackThumb({
  artUrl,
  size = "size-10",
  radius = "rounded-md",
  /**
   * `lazy` for a cover inside a long list — the browser then fetches only what
   * is near the viewport instead of every cover at once. `eager` suits the one
   * cover that is on screen immediately, where deferring only adds a flash.
   */
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
        // Decoding off the main thread: a list scrolling past dozens of covers
        // must not stutter while each one is turned into pixels.
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
