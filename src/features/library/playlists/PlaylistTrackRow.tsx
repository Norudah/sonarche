import { GripVertical } from "lucide-react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { albumPath, artistPath } from "@/app/routes";
import type { LibraryTrack } from "@/features/library/api";
import { rowPlayHandler } from "@/features/library/tracks/rowPlay";
import { RowActions } from "@/features/library/tracks/RowActions";
import { NUMERIC, PAD } from "@/features/library/tracks/tableGrid";
import { TrackIndexCell } from "@/features/library/tracks/TrackIndexCell";
import { formatDuration } from "@/shared/lib/format";
import { usePlayer } from "@/shared/player/PlayerContext";
import { TrackThumb } from "@/shared/ui/TrackThumb";

const CELL = `${PAD} py-2 text-[0.8125rem] text-muted`;
const CELL_LINK = "block truncate outline-none hover:text-foreground hover:underline focus-visible:text-foreground";

interface PlaylistTrackRowProps {
  track: LibraryTrack;
  /** 0-based row number as displayed — the playlist's own order, or the sort
   * laid over it. Mutations address stored positions; the list maps them. */
  position: number;
  /** False while a column sort is active: display and stored order then
   * disagree, so the handle would move a different row than the one held. */
  canReorder: boolean;
  style?: CSSProperties;
  /** True for the row currently being dragged: it rides over its neighbours,
   * so it needs a floor under its cells. */
  isDragging: boolean;
  dragHandleProps: { onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void };
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRemoveFromPlaylist: () => void;
  onAddToPlaylist: () => void;
}

/**
 * One playlist row. Same anatomy as the library-wide `TrackRow` plus the drag
 * handle, and numbered by *position* rather than track tag — a playlist is its
 * own order, not the album's.
 */
export function PlaylistTrackRow({
  track,
  position,
  canReorder,
  style,
  isDragging,
  dragHandleProps,
  onPlay,
  onEdit,
  onDelete,
  onRemoveFromPlaylist,
  onAddToPlaylist,
}: PlaylistTrackRowProps) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");
  const { current, isPlaying } = usePlayer();
  const isCurrent = current?.id === track.id;

  const owner = track.albumArtist.trim() || track.artist.trim();
  const artistLink = owner === track.artist.trim() && owner !== "" ? artistPath(owner) : null;
  const albumLink = track.album.trim() !== "" ? albumPath(owner, track.album) : null;

  return (
    <tr
      style={style}
      onDoubleClick={rowPlayHandler(onPlay)}
      className={
        "group/row select-none [&>td]:transition-colors [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg " +
        (isDragging ? "[&>td]:bg-default/70" : isCurrent ? "[&>td]:bg-accent/10" : "hover:[&>td]:bg-default/40")
      }
    >
      <td className={`${CELL} w-8 px-1`}>
        {canReorder && (
          <button
            type="button"
            aria-label={t("playlists.dragToReorder")}
            {...dragHandleProps}
            className="flex size-6 cursor-grab touch-none items-center justify-center rounded text-muted opacity-0 outline-none transition-opacity group-hover/row:opacity-60 hover:opacity-100! focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent/40 active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        )}
      </td>

      <td className={`${CELL} w-12`}>
        <div className="flex justify-center">
          <TrackIndexCell
            index={position + 1}
            isCurrent={isCurrent}
            isPlaying={isPlaying}
            onPlay={onPlay}
            label={isCurrent && isPlaying ? tPlayer("pause") : tPlayer("play")}
          />
        </div>
      </td>

      <td className={CELL}>
        <div className="flex items-center gap-3">
          <TrackThumb artUrl={track.artUrl} />
          <span
            className={
              "truncate text-sm font-medium transition-colors " + (isCurrent ? "text-accent" : "text-foreground")
            }
          >
            {track.title || t("unknownTitle")}
          </span>
        </div>
      </td>

      <td className={`${CELL} w-[18%]`}>
        {artistLink ? (
          <Link to={artistLink} className={CELL_LINK}>
            {track.artist}
          </Link>
        ) : (
          <span className="block truncate">{track.artist || t("unknownArtist")}</span>
        )}
      </td>

      <td className={`${CELL} w-[18%]`}>
        {albumLink ? (
          <Link to={albumLink} className={CELL_LINK}>
            {track.album}
          </Link>
        ) : (
          <span className="block truncate">{t("metadata.emptyValue")}</span>
        )}
      </td>

      <td className={`${CELL} w-20 ${NUMERIC} text-right`}>
        <span className="block">{track.length != null ? formatDuration(track.length) : t("metadata.emptyValue")}</span>
      </td>

      {/* Same load-bearing wrapper as the other tables — see TrackRow. */}
      <td className={`${CELL} w-36 pl-6`}>
        <div>
          <RowActions
            onEdit={onEdit}
            onDelete={onDelete}
            onAddToPlaylist={onAddToPlaylist}
            onRemoveFromPlaylist={onRemoveFromPlaylist}
            favoriteId={track.id}
          />
        </div>
      </td>
    </tr>
  );
}
