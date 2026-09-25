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

/** A playlist's sidebar glyph: an icon, its artwork, or a colour. Stored as
 * `icon:<key>` / `cover` / `color:<key>`; unknown keys fall back to the
 * default, so adding icons needs no migration. */

/** Picker order is part of the design; unknown keys resolve as not shipped. */
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

/** The theme.css tones, in picker order. */
export const MARKER_COLORS = ["indigo", "violet", "rose", "amber", "moss", "teal", "sky", "blue"] as const;

export type MarkerColor = (typeof MARKER_COLORS)[number];

export function markerTone(color: MarkerColor): string {
  return `var(--playlist-${color})`;
}

export type PlaylistMarker =
  /** `filled` is reserved for the favorites heart. */
  | { mode: "icon"; key: string; icon: LucideIcon; filled?: boolean }
  | { mode: "cover"; url: string }
  | { mode: "color"; key: MarkerColor; tone: string };

/** Filled heart for favorites, the playlist glyph otherwise. */
function defaultMarker(playlist: Playlist): PlaylistMarker {
  return playlist.kind === "favorites"
    ? { mode: "icon", key: "heart", icon: Heart, filled: true }
    : { mode: "icon", key: "list-music", icon: ListMusic };
}

/** Unknown keys and `cover` without an image fall back to the default. */
export function resolveMarker(playlist: Playlist): PlaylistMarker {
  // Favorites always wears the heart, whatever an older stored marker says.
  if (playlist.kind === "favorites") return defaultMarker(playlist);

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

/** Inverse of the parsing above. */
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
