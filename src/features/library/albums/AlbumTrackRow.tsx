import { FileText, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { TrackIndexCell } from "@/features/library/tracks/TrackIndexCell";
import { usePlayTrack } from "@/features/library/usePlayTrack";
import { formatDuration } from "@/shared/lib/format";
import { usePlayer } from "@/shared/player/PlayerContext";

const CELL = "px-3 py-2 text-[0.8125rem] text-muted";
const ACTION =
  "cursor-pointer rounded-md p-1.5 text-muted outline-none transition-colors hover:bg-default/70 focus-visible:ring-2 focus-visible:ring-accent/40";

interface AlbumTrackRowProps {
  track: LibraryTrack;
  /** Position in the album, used when beets never tagged a track number. */
  position: number;
  /** Compilations only: the per-track artist is meaningless on a single-artist
   * album, where it just repeats the header twelve times. */
  showArtist: boolean;
  style?: CSSProperties;
  onInspect: () => void;
  onDelete: () => void;
}

export function AlbumTrackRow({
  track,
  position,
  showArtist,
  style,
  onInspect,
  onDelete,
}: AlbumTrackRowProps) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");
  const { current, isPlaying } = usePlayer();
  const playTrack = usePlayTrack();
  const isCurrent = current?.id === track.id;

  return (
    <tr
      style={style}
      className={
        "group/row row-cascade [&>td]:transition-colors [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg " +
        (isCurrent ? "[&>td]:bg-accent/10" : "hover:[&>td]:bg-default/40")
      }
    >
      <td className={`${CELL} w-14`}>
        <TrackIndexCell
          index={track.track ?? position}
          isCurrent={isCurrent}
          isPlaying={isPlaying}
          onPlay={() => playTrack(track)}
          label={isCurrent && isPlaying ? tPlayer("pause") : tPlayer("play")}
        />
      </td>

      <td className={CELL}>
        <div className="min-w-0">
          <span
            className={
              "block truncate text-sm font-medium transition-colors " +
              (isCurrent ? "text-accent" : "text-foreground")
            }
          >
            {track.title || t("unknownTitle")}
          </span>
          {/* The bonus origin was already surfaced in the metadata drawer; on the
           * album it explains why a track nobody expects is sitting here. */}
          {track.bonusSource && (
            <span className="block truncate text-[0.6875rem] text-warning">
              {t("albums.bonusFrom", { source: track.bonusSource })}
            </span>
          )}
        </div>
      </td>

      {showArtist && (
        <td className={`${CELL} w-[22%]`}>
          <span className="block truncate">{track.artist || t("unknownArtist")}</span>
        </td>
      )}

      <td className={`${CELL} w-16 text-right tabular-nums`}>
        <span className="block">
          {track.length != null ? formatDuration(track.length) : t("metadata.emptyValue")}
        </span>
      </td>

      <td className={`${CELL} w-16`}>
        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
          <button
            type="button"
            onClick={onInspect}
            aria-label={t("metadata.inspect")}
            className={`${ACTION} hover:text-foreground`}
          >
            <FileText className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={t("delete.action")}
            className={`${ACTION} hover:text-danger`}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
