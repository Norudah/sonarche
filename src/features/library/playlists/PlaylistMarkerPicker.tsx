import { cn } from "@heroui/react";
import { ImagePlus, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  markerTone,
  markerValue,
  MARKER_COLORS,
  MARKER_ICONS,
  type PlaylistMarker,
} from "@/features/library/playlists/marker";
import { PlaylistGlyph } from "@/features/library/playlists/PlaylistGlyph";

interface PlaylistMarkerPickerProps {
  /** The stored marker string being edited, or null for "the default glyph". */
  value: string | null;
  onPick: (value: string) => void;
  /** The playlist's image, when it has one — the thumbnail cell needs a picture
   * to offer. */
  coverUrl: string | null;
  /** Opens the image step: an inert cell with an explanation is worse than a
   * way out. */
  onAddImage: () => void;
}

function Cell({
  selected,
  label,
  onPick,
  children,
}: {
  selected: boolean;
  label: string;
  onPick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onPick}
      className={cn(
        "flex size-10 cursor-pointer items-center justify-center rounded-xl outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-accent/40",
        selected ? "bg-accent-soft text-accent ring-1 ring-accent/50" : "text-muted hover:bg-default/50",
      )}
    >
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold tracking-widest text-muted/70 uppercase">{label}</p>
      {children}
    </div>
  );
}

/**
 * The grid of faces a playlist can wear in the navigation — an icon, its own
 * artwork, or a flat colour.
 *
 * Controlled: it holds nothing and writes nothing. It used to be a modal of
 * its own that wrote straight through, which made the sidebar row the live
 * confirmation; now that the same modal also carries the name, a single
 * "Enregistrer" governs both, and the preview above the grid does the
 * confirming instead.
 */
export function PlaylistMarkerPicker({ value, onPick, coverUrl, onAddImage }: PlaylistMarkerPickerProps) {
  const { t } = useTranslation("library");

  const pick = (choice: PlaylistMarker) => onPick(markerValue(choice));
  const selected = (candidate: string) => value === candidate;

  return (
    <div className="flex flex-col gap-5" role="radiogroup" aria-label={t("playlists.marker.title")}>
      <Group label={t("playlists.marker.icons")}>
        <div className="grid grid-cols-8 gap-1">
          {MARKER_ICONS.map(({ key, icon: Icon }) => (
            <Cell
              key={key}
              selected={selected(`icon:${key}`)}
              label={t(`playlists.marker.icon.${key}`)}
              onPick={() => pick({ mode: "icon", key, icon: Icon })}
            >
              <Icon className="size-4" />
            </Cell>
          ))}
        </div>
      </Group>

      <Group label={t("playlists.marker.colors")}>
        <div className="grid grid-cols-8 gap-1">
          {MARKER_COLORS.map((color) => (
            <Cell
              key={color}
              selected={selected(`color:${color}`)}
              label={t(`playlists.marker.color.${color}`)}
              onPick={() => pick({ mode: "color", key: color, tone: markerTone(color) })}
            >
              <PlaylistGlyph marker={{ mode: "color", key: color, tone: markerTone(color) }} className="size-5" />
            </Cell>
          ))}
        </div>
      </Group>

      <Group label={t("playlists.marker.image")}>
        {coverUrl ? (
          <Cell
            selected={selected("cover")}
            label={t("playlists.marker.imageCell")}
            onPick={() => pick({ mode: "cover", url: coverUrl })}
          >
            <PlaylistGlyph marker={{ mode: "cover", url: coverUrl }} className="size-6" />
          </Cell>
        ) : (
          <button
            type="button"
            onClick={onAddImage}
            className="flex cursor-pointer items-center gap-2 self-start rounded-xl px-2 py-1.5 text-[0.8125rem] text-muted outline-none transition-colors hover:bg-default/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <ImagePlus className="size-4 shrink-0" />
            {t("playlists.marker.noImage")}
          </button>
        )}
      </Group>

      <button
        type="button"
        disabled={value == null}
        onClick={() => onPick("")}
        className="flex cursor-pointer items-center gap-1.5 self-start rounded-full text-[0.8125rem] font-medium text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-40 disabled:hover:text-muted"
      >
        <RotateCcw className="size-3.5" />
        {t("playlists.marker.reset")}
      </button>
    </div>
  );
}
