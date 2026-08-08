import { cn } from "@heroui/react";

import type { Playlist } from "@/features/library/playlists/api";
import { resolveMarker, type PlaylistMarker } from "@/features/library/playlists/marker";

interface PlaylistGlyphProps {
  marker: PlaylistMarker;
  /** Sizing and spacing from the call site; the glyph only fills the box. */
  className?: string;
}

/**
 * The 16px face a playlist wears in the navigation.
 *
 * The three modes are deliberately not normalised into one shape: a stroked
 * icon has to keep the optical weight of the nav icons above it, while a
 * thumbnail and a colour chip are solid objects and read as a tile. So the
 * icon inherits `currentColor` and the active pill tints it like any other nav
 * glyph, and the other two keep their own colour and take a hairline instead —
 * a small square of artwork on a pale sidebar needs an edge or it floats.
 */
export function PlaylistGlyph({ marker, className }: PlaylistGlyphProps) {
  if (marker.mode === "icon") {
    return <marker.icon className={cn("shrink-0", className)} />;
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

/** The same glyph straight from a playlist — what every call site outside the
 * picker wants, since only the picker draws markers the playlist does not wear
 * yet. */
export function PlaylistMarkerGlyph({ playlist, className }: { playlist: Playlist; className?: string }) {
  return <PlaylistGlyph marker={resolveMarker(playlist)} className={className} />;
}
