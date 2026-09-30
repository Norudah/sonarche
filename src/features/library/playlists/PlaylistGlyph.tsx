import { cn } from "@heroui/react";

import type { Playlist } from "@/features/library/playlists/api";
import { resolveMarker, type PlaylistMarker } from "@/features/library/playlists/marker";

interface PlaylistGlyphProps {
  marker: PlaylistMarker;
  /** The glyph fills the box sized by the caller. */
  className?: string;
}

/** A playlist's 16px sidebar glyph. Icons inherit `currentColor` like other nav
 * icons; thumbnails and colour chips keep their colour and get a hairline. */
export function PlaylistGlyph({ marker, className }: PlaylistGlyphProps) {
  if (marker.mode === "icon") {
    return <marker.icon className={cn("shrink-0", marker.filled && "fill-current", className)} />;
  }
  if (marker.mode === "cover") {
    return (
      <img
        src={marker.url}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("shrink-0 rounded-[0.25rem] object-cover ring-1 ring-artwork-edge", className)}
      />
    );
  }
  return (
    <span
      style={{ backgroundColor: marker.tone }}
      className={cn("shrink-0 rounded-[0.25rem] ring-1 ring-artwork-edge", className)}
    />
  );
}

/** The glyph a playlist currently wears. */
export function PlaylistMarkerGlyph({ playlist, className }: { playlist: Playlist; className?: string }) {
  return <PlaylistGlyph marker={resolveMarker(playlist)} className={className} />;
}
