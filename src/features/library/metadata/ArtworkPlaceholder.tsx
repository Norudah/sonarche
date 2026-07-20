import { Music } from "lucide-react";

/** App-standard artwork stand-in: always square, accent-tinted, never a broken
 * image. Used wherever a track has no embedded cover. */
export function ArtworkPlaceholder({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={
        "flex aspect-square items-center justify-center bg-gradient-to-br from-accent/35 to-accent/70" +
        (className ? ` ${className}` : "")
      }
    >
      <Music className="size-1/3 text-white/80" />
    </div>
  );
}
