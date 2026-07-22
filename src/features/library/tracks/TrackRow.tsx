import { Music } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { rowPlayHandler } from "@/features/library/tracks/rowPlay";
import { RowActions } from "@/features/library/tracks/RowActions";
import { TrackIndexCell } from "@/features/library/tracks/TrackIndexCell";
import { usePlayTrack } from "@/features/library/usePlayTrack";
import { formatDuration } from "@/shared/lib/format";
import { usePlayer } from "@/shared/player/PlayerContext";

const CELL = "px-3 py-2 text-[0.8125rem] text-muted";

interface TrackRowProps {
  track: LibraryTrack;
  index: number;
  /** Play the entrance animation. Off when the table is windowed: rows then
   * mount and unmount as the user scrolls, and the cascade would re-fire on
   * every one of them instead of playing once for the list. */
  cascade?: boolean;
  style?: CSSProperties;
  onInspect: () => void;
  onDelete: () => void;
}

export function TrackRow({ track, index, cascade = true, style, onInspect, onDelete }: TrackRowProps) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");
  const { current, isPlaying } = usePlayer();
  const playTrack = usePlayTrack();
  const isCurrent = current?.id === track.id;

  return (
    <tr
      style={style}
      onDoubleClick={rowPlayHandler(() => playTrack(track))}
      className={
        "group/row select-none [&>td]:transition-colors [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg " +
        (cascade ? "row-cascade " : "") +
        (isCurrent ? "[&>td]:bg-accent/10" : "hover:[&>td]:bg-default/40")
      }
    >
      <td className={`${CELL} w-14`}>
        {/* Centred under its "#" header: the button is narrower than the column,
         * so left-aligning it left every number visibly off its own label. */}
        <div className="flex justify-center">
          <TrackIndexCell
            index={index}
            isCurrent={isCurrent}
            isPlaying={isPlaying}
            onPlay={() => playTrack(track)}
            label={isCurrent && isPlaying ? tPlayer("pause") : tPlayer("play")}
          />
        </div>
      </td>

      <td className={CELL}>
        <div className="flex items-center gap-3">
          {track.artUrl ? (
            <img
              src={track.artUrl}
              alt=""
              // A library-wide tracklist holds one of these per row; without
              // this the browser fetches every cover in the library at once.
              loading="lazy"
              decoding="async"
              className="size-10 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-default/60">
              <Music className="size-4 text-muted" />
            </div>
          )}
          <span
            className={
              "truncate text-sm font-medium transition-colors " + (isCurrent ? "text-accent" : "text-foreground")
            }
          >
            {track.title || t("unknownTitle")}
          </span>
        </div>
      </td>

      <td className={CELL}>
        <span className="block truncate">{track.artist || t("unknownArtist")}</span>
      </td>

      <td className={CELL}>
        <span className="block truncate">{track.album || t("metadata.emptyValue")}</span>
      </td>

      <td className={CELL}>
        {/* Amber is the app's "incomplete metadata" signal — an untagged track
         * is exactly that, so the missing genre reads as a nudge, not as noise. */}
        <span
          className={
            "inline-block max-w-full truncate rounded-md px-2 py-0.5 text-[0.6875rem] " +
            (track.genre ? "bg-default/70 text-foreground" : "bg-warning-soft text-warning")
          }
        >
          {track.genre ?? t("genres.none")}
        </span>
      </td>

      {/* Wrapped in a span, not raw text: the row cascade animates each cell's
       * child element, and a bare text node has nothing to animate. */}
      <td className={`${CELL} w-16 text-right tabular-nums`}>
        <span className="block">{track.length != null ? formatDuration(track.length) : t("metadata.emptyValue")}</span>
      </td>

      {/* The wrapper is load-bearing: `row-cascade` animates `td > *`, and if
       * the actions were that child the keyframe would override their idle
       * opacity for the length of the entrance — every row would flash its icons
       * on arrival. The animation lands on this div; the hover layer sits a
       * level deeper. `pl-6` is the breathing room from the duration column. */}
      <td className={`${CELL} w-28 pl-6`}>
        <div>
          <RowActions onInspect={onInspect} onDelete={onDelete} />
        </div>
      </td>
    </tr>
  );
}
