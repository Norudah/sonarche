import {
  Car,
  Disc3,
  Dumbbell,
  Flame,
  Guitar,
  Headphones,
  Heart,
  ListMusic,
  Mic2,
  Moon,
  Radio,
  Sparkles,
  Star,
  Sun,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { Playlist } from "@/features/library/playlists/api";

/**
 * What a playlist wears in the navigation.
 *
 * A nav row is 16px of identity, and the three answers people actually reach
 * for are different in kind: a glyph that says what the list is *for*, the
 * list's own artwork shrunk down, or a flat colour when that artwork turns to
 * mush at this size. So the marker is a small tagged union rather than one
 * mechanism stretched over all three.
 *
 * Stored as a single string (`icon:<key>` / `cover` / `color:<key>`) — the
 * backend validates the shape and keeps the keys opaque, so adding an icon
 * here needs no migration, and a key an older build does not know falls back
 * to the default glyph rather than rendering nothing.
 */

/** The curated icon set: two rows of eight in the picker. Instruments and
 * playback first, then the moods and occasions people name playlists after.
 * A list rather than a map because the order is part of the design, and
 * because a lookup then answers "not shipped" honestly. */
export const MARKER_ICONS: { key: string; icon: LucideIcon }[] = [
  { key: "list-music", icon: ListMusic },
  { key: "disc", icon: Disc3 },
  { key: "headphones", icon: Headphones },
  { key: "guitar", icon: Guitar },
  { key: "mic", icon: Mic2 },
  { key: "radio", icon: Radio },
  { key: "waves", icon: Waves },
  { key: "sparkles", icon: Sparkles },
  { key: "heart", icon: Heart },
  { key: "star", icon: Star },
  { key: "flame", icon: Flame },
  { key: "zap", icon: Zap },
  { key: "sun", icon: Sun },
  { key: "moon", icon: Moon },
  { key: "dumbbell", icon: Dumbbell },
  { key: "car", icon: Car },
];

const ICON_BY_KEY = new Map(MARKER_ICONS.map(({ key, icon }) => [key, icon]));

/** The eight tones from theme.css, in the order the picker lays them out. */
export const MARKER_COLORS = ["indigo", "violet", "rose", "amber", "moss", "teal", "sky", "blue"] as const;

export type MarkerColor = (typeof MARKER_COLORS)[number];

export function markerTone(color: MarkerColor): string {
  return `var(--playlist-${color})`;
}

export type PlaylistMarker =
  | { mode: "icon"; key: string; icon: LucideIcon }
  | { mode: "cover"; url: string }
  | { mode: "color"; key: MarkerColor; tone: string };

/** The glyph a playlist falls back to: the heart for the built-in favorites —
 * it is that list's whole identity — and the playlist glyph for the rest. */
function defaultMarker(playlist: Playlist): PlaylistMarker {
  return playlist.kind === "favorites"
    ? { mode: "icon", key: "heart", icon: Heart }
    : { mode: "icon", key: "list-music", icon: ListMusic };
}

/**
 * The stored string resolved against the playlist it belongs to.
 *
 * Two cases fall back rather than fail: a key this build does not ship, and
 * `cover` on a playlist whose image has since been removed. Both would
 * otherwise leave a hole in the navigation over a choice the user made once
 * and cannot see any more.
 */
export function resolveMarker(playlist: Playlist): PlaylistMarker {
  const stored = playlist.marker;
  if (stored == null) return defaultMarker(playlist);

  if (stored === "cover") {
    return playlist.coverUrl ? { mode: "cover", url: playlist.coverUrl } : defaultMarker(playlist);
  }

  const [prefix, key = ""] = stored.split(":");
  if (prefix === "icon") {
    const icon = ICON_BY_KEY.get(key);
    return icon ? { mode: "icon", key, icon } : defaultMarker(playlist);
  }
  if (prefix === "color" && (MARKER_COLORS as readonly string[]).includes(key)) {
    const color = key as MarkerColor;
    return { mode: "color", key: color, tone: markerTone(color) };
  }
  return defaultMarker(playlist);
}

/** The stored string for a choice made in the picker — the inverse of the
 * parsing above, so the two can never drift apart. */
export function markerValue(choice: PlaylistMarker): string {
  switch (choice.mode) {
    case "icon":
      return `icon:${choice.key}`;
    case "cover":
      return "cover";
    case "color":
      return `color:${choice.key}`;
  }
}
