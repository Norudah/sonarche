import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { tagCounts } from "@/features/library/metadata/fields";
import { rowPlayHandler } from "@/features/library/tracks/rowPlay";
import { RowActions } from "@/features/library/tracks/RowActions";
import { TrackIndexCell } from "@/features/library/tracks/TrackIndexCell";
import { formatDuration } from "@/shared/lib/format";
import { usePlayer } from "@/shared/player/PlayerContext";

const CELL = "px-3 py-2 text-[0.8125rem] text-muted";

/**
 * The track's tag score, as filled fields over total.
 *
 * A ratio and not a percentage: this app's whole subject is filling tags in, so
 * "5/7" names two fields to go, where "71%" is a grade with nothing to act on.
 * The album's own card reads the same way for the same reason.
 *
 * Per track and not only per album, because the album figure says how much is
 * missing without ever saying where — amber is the app's reserved "incomplete
 * metadata" hue, so a tracklist can be scanned for the row that needs you.
 */
function TagScore({ track }: { track: LibraryTrack }) {
  const { t } = useTranslation("library");
  const { filled, total } = tagCounts(track);
  const isComplete = filled === total;

  return (
    <span
      title={t("albums.tagScoreHint")}
      className={"inline-flex items-center gap-1.5 tabular-nums " + (isComplete ? "text-muted" : "text-warning")}
    >
      <span className={"size-1.5 rounded-full " + (isComplete ? "bg-success" : "bg-warning")} />
      {filled}/{total}
    </span>
  );
}

interface AlbumTrackRowProps {
  track: LibraryTrack;
  /** Position in the album, used when beets never tagged a track number. */
  position: number;
  style?: CSSProperties;
  /** Launch playback at this row, with the album as the queue. */
  onPlay: () => void;
  onInspect: () => void;
  onDelete: () => void;
}

export function AlbumTrackRow({ track, position, style, onPlay, onInspect, onDelete }: AlbumTrackRowProps) {
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
        {/* Centred under its "#" header: the button is narrower than the column,
         * so left-aligning it left every number visibly off its own label. */}
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
          {/* The bonus origin was already surfaced in the metadata drawer; on
           * the album it explains why a track nobody expects is sitting here. */}
          {track.bonusSource && (
            <span className="block truncate text-[0.6875rem] text-warning">
              {t("albums.bonusFrom", { source: track.bonusSource })}
            </span>
          )}
        </div>
      </td>

      {/* Always shown, unlike the library-wide table's optional column: a
       * featuring credit differs from the album artist on exactly the rows that
       * matter, and hiding the column on a "single-artist" album is what makes
       * those rows invisible. */}
      <td className={`${CELL} w-[22%]`}>
        <span className="block truncate">{track.artist || t("unknownArtist")}</span>
      </td>

      <td className={`${CELL} w-20`}>
        <TagScore track={track} />
      </td>

      <td className={`${CELL} w-16 text-right tabular-nums`}>
        <span className="block">{track.length != null ? formatDuration(track.length) : t("metadata.emptyValue")}</span>
      </td>

      {/* The extra wrapper is load-bearing, not decoration. `row-cascade`
       * animates `td > *` from opacity 0 to 1, and the actions used to *be*
       * that child: the keyframe overrode their `opacity-0` for the length of
       * the entrance, so every row flashed its icons on arrival and then
       * dropped them. The animation now lands on this div and the hidden layer
       * sits one level deeper, where nothing touches it. `pl-6` is the
       * breathing room — at `px-3` the icons sat against the duration. */}
      <td className={`${CELL} w-28 pl-6`}>
        <div>
          <RowActions onInspect={onInspect} onDelete={onDelete} />
        </div>
      </td>
    </tr>
  );
}
