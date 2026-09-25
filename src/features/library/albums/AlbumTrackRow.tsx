import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import type { DoorKey } from "@/features/library/triage/queue";
import { ATTENTION_LABEL } from "@/features/library/albums/attentionLabels";
import { rowPlayHandler } from "@/features/library/tracks/rowPlay";
import { RowActions } from "@/features/library/tracks/RowActions";
import { TrackIndexCell } from "@/features/library/tracks/TrackIndexCell";
import { NUMERIC, PAD } from "@/features/library/tracks/tableGrid";
import { formatDuration } from "@/shared/lib/format";
import { usePlayer } from "@/shared/player/PlayerContext";

const CELL = `${PAD} py-2 text-[0.8125rem] text-muted`;

/** A dot when the Metadata page still names this track; nothing when settled. */
function AttentionDot({ flags }: { flags: DoorKey[] }) {
  const { t } = useTranslation("library");
  if (flags.length === 0) return null;

  const names = flags.map((flag) => ATTENTION_LABEL[flag]).filter((key) => key != null);

  return (
    <span
      title={names.map((key) => t(key)).join(" · ")}
      className="inline-block size-1.5 rounded-full bg-warning align-middle"
    />
  );
}

interface AlbumTrackRowProps {
  track: LibraryTrack;
  /** Used when beets has no track number. */
  position: number;
  /** Checks still naming this track. */
  flags: DoorKey[];
  style?: CSSProperties;
  /** Plays from this row with the album as the queue. */
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddToPlaylist: () => void;
  onMoveToAlbum: () => void;
}

export function AlbumTrackRow({
  track,
  position,
  flags,
  style,
  onPlay,
  onEdit,
  onDelete,
  onAddToPlaylist,
  onMoveToAlbum,
}: AlbumTrackRowProps) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");
  const { current, isPlaying } = usePlayer();
  const isCurrent = current?.id === track.id;

  return (
    <tr
      style={style}
      onDoubleClick={rowPlayHandler(onPlay)}
      className={
        "group/row row-cascade select-none [&>td]:transition-colors [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg " +
        (isCurrent ? "[&>td]:bg-accent/10" : "hover:[&>td]:bg-default/40")
      }
    >
      <td className={`${CELL} w-14`}>
        {/* Centred under the "#" header. */}
        <div className="flex justify-center">
          <TrackIndexCell
            index={track.track ?? position}
            isCurrent={isCurrent}
            isPlaying={isPlaying}
            onPlay={onPlay}
            label={isCurrent && isPlaying ? tPlayer("pause") : tPlayer("play")}
          />
        </div>
      </td>

      <td className={CELL}>
        <div className="min-w-0">
          <span
            className={
              "block truncate text-sm font-medium transition-colors " + (isCurrent ? "text-accent" : "text-foreground")
            }
          >
            {track.title || t("unknownTitle")}
          </span>
          {/* Explains an unexpected track on the album. */}
          {track.bonusSource && (
            <span className="block truncate text-[0.6875rem] text-warning">
              {t("albums.bonusFrom", { source: track.bonusSource })}
            </span>
          )}
        </div>
      </td>

      {/* Always shown: featuring credits matter most on "single-artist" albums. */}
      <td className={`${CELL} w-[22%]`}>
        <span className="block truncate">{track.artist || t("unknownArtist")}</span>
      </td>

      {/* Amber when missing; albums can mix genres. */}
      <td className={`${CELL} w-[16%]`}>
        <span
          className={
            "inline-block max-w-full truncate rounded-md px-2 py-0.5 text-[0.6875rem] " +
            (track.genre ? "bg-default/70 text-foreground" : "bg-warning-soft text-warning")
          }
        >
          {track.genre ?? t("genres.none")}
        </span>
      </td>

      <td className={`${CELL} w-8 text-center`}>
        <AttentionDot flags={flags} />
      </td>

      <td className={`${CELL} w-20 ${NUMERIC} text-right`}>
        <span className="block">{track.length != null ? formatDuration(track.length) : t("metadata.emptyValue")}</span>
      </td>

      {/* The wrapper takes `row-cascade`'s `td > *` animation, which would
          otherwise override the actions' `opacity-0` and flash them. */}
      <td className={`${CELL} w-36 pl-6`}>
        <div>
          <RowActions
            onEdit={onEdit}
            onDelete={onDelete}
            onAddToPlaylist={onAddToPlaylist}
            onMoveToAlbum={onMoveToAlbum}
            favoriteId={track.id}
          />
        </div>
      </td>
    </tr>
  );
}
