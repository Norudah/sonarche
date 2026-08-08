import { cn, Modal } from "@heroui/react";
import { ImagePlus, RotateCcw, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { Playlist } from "@/features/library/playlists/api";
import { useSetPlaylistMarker } from "@/features/library/playlists/hooks";
import {
  markerTone,
  markerValue,
  MARKER_COLORS,
  MARKER_ICONS,
  resolveMarker,
  type PlaylistMarker,
} from "@/features/library/playlists/marker";
import { PlaylistGlyph } from "@/features/library/playlists/PlaylistGlyph";

interface PlaylistMarkerDialogProps {
  playlist: Playlist;
  /** The name as shown — the favorites' localized label. */
  displayName: string;
  isOpen: boolean;
  onClose: () => void;
  /** Opens the image modal: the thumbnail cell is inert without one, and a
   * dead cell with an explanation is worse than a way out. */
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

function MarkerPicker({ playlist, displayName, onClose, onAddImage }: Omit<PlaylistMarkerDialogProps, "isOpen">) {
  const { t } = useTranslation("library");
  const setMarker = useSetPlaylistMarker();

  const pick = (choice: PlaylistMarker) => setMarker.mutate({ id: playlist.id, marker: markerValue(choice) });
  const selected = (value: string) => playlist.marker === value;

  return (
    <div className="flex flex-col">
      <header className="flex items-start gap-3 px-6 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
            {t("playlists.marker.title")}
          </h2>
          <p className="mt-0.5 text-[0.75rem] text-muted">{t("playlists.marker.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("metadata.close")}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-default/60 text-muted outline-none transition-colors hover:bg-default hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <X className="size-3.5" />
        </button>
      </header>

      {/* The decision itself, at the size it will be lived with: the nav row as
          it will look, on the sidebar's own surface and wearing the active
          pill. Everything below is a way of changing this one line. */}
      <div className="mx-6 rounded-xl bg-background p-3 ring-1 ring-separator">
        <div className="flex items-center gap-3 rounded-lg bg-accent/15 px-3 py-1.5 text-sm font-medium text-accent">
          <PlaylistGlyph marker={resolveMarker(playlist)} className="size-4" />
          <span className="min-w-0 truncate">{displayName}</span>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-6 py-5" role="radiogroup" aria-label={t("playlists.marker.title")}>
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

        <Group label={t("playlists.marker.image")}>
          {playlist.coverUrl ? (
            <Cell
              selected={selected("cover")}
              label={t("playlists.marker.imageCell")}
              onPick={() => pick({ mode: "cover", url: playlist.coverUrl as string })}
            >
              <PlaylistGlyph marker={{ mode: "cover", url: playlist.coverUrl }} className="size-6" />
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
      </div>

      <footer className="flex items-center justify-between gap-2 px-6 pb-5">
        <button
          type="button"
          disabled={playlist.marker == null}
          onClick={() => setMarker.mutate({ id: playlist.id, marker: "" })}
          className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-40 disabled:hover:text-muted"
        >
          <RotateCcw className="size-3.5" />
          {t("playlists.marker.reset")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-xl bg-accent px-4 py-1.5 text-[0.8125rem] font-medium text-accent-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {t("playlists.marker.done")}
        </button>
      </footer>
    </div>
  );
}

/**
 * The face a playlist wears in the navigation.
 *
 * No confirm step: every cell writes straight through (optimistically), and
 * the preview above them is the confirmation — a choice you can see is worth
 * more than a choice you have to validate, and undoing it is one more click on
 * a grid that is already open.
 */
export function PlaylistMarkerDialog({ isOpen, ...rest }: PlaylistMarkerDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nowOpen) => {
        if (!nowOpen) rest.onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="w-[27rem] max-w-[95vw] rounded-2xl p-0!">
            {isOpen && <MarkerPicker {...rest} />}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
