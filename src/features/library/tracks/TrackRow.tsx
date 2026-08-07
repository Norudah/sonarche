import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { albumPath, artistPath } from "@/app/routes";
import type { LibraryTrack } from "@/features/library/api";
import { rowPlayHandler } from "@/features/library/tracks/rowPlay";
import { RowActions } from "@/features/library/tracks/RowActions";
import { TrackIndexCell } from "@/features/library/tracks/TrackIndexCell";
import { formatDuration } from "@/shared/lib/format";
import { usePlayer } from "@/shared/player/PlayerContext";
import { TrackThumb } from "@/shared/ui/TrackThumb";

const CELL = "px-3 py-2 text-[0.8125rem] text-muted";

/* Underline on hover only. A row holds two of these and permanently underlined
 * text would turn the table into a page of links; the pointer plus the reveal is
 * enough to say they are one. */
const CELL_LINK = "block truncate outline-none hover:text-foreground hover:underline focus-visible:text-foreground";

interface TrackRowProps {
  track: LibraryTrack;
  index: number;
  /** Play the entrance animation. Off when the table is windowed: rows then
   * mount and unmount as the user scrolls, and the cascade would re-fire on
   * every one of them instead of playing once for the list. */
  cascade?: boolean;
  style?: CSSProperties;
  /** Album artist of the page this row is on, when it has one. A row filed under
   * anyone else is a guest spot and says so. */
  guestOwner?: string;
  /** Launch playback at this row, in the list's own context. The table owns
   * the list, so the table decides what the queue is. */
  onPlay: () => void;
  onInspect: () => void;
  onDelete: () => void;
  onAddToPlaylist: () => void;
}

export function TrackRow({
  track,
  index,
  cascade = true,
  style,
  guestOwner,
  onPlay,
  onInspect,
  onDelete,
  onAddToPlaylist,
}: TrackRowProps) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");
  const { current, isPlaying } = usePlayer();
  const isCurrent = current?.id === track.id;

  // Who the record is filed under — the album artist, or the track's own when
  // beets left it empty. Both the album route and the guest test key off it.
  const owner = track.albumArtist.trim() || track.artist.trim();
  // An artist page exists per *album* artist, so only a credited artist who owns
  // the record has one. A featuring credit on someone else's album leads
  // nowhere, and a link into a page that redirects straight back out is worse
  // than plain text.
  const artistLink = owner === track.artist.trim() && owner !== "" ? artistPath(owner) : null;
  const albumLink = track.album.trim() !== "" ? albumPath(owner, track.album) : null;
  const isGuest = guestOwner != null && owner !== guestOwner;

  return (
    <tr
      style={style}
      onDoubleClick={rowPlayHandler(onPlay)}
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
            onPlay={onPlay}
            label={isCurrent && isPlaying ? tPlayer("pause") : tPlayer("play")}
          />
        </div>
      </td>

      <td className={CELL}>
        <div className="flex items-center gap-3">
          {/* Lazy: a library-wide tracklist holds one of these per row, and
              eager loading fetched every cover in the library at once. */}
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

      <td className={CELL}>
        {artistLink ? (
          <Link to={artistLink} className={CELL_LINK}>
            {track.artist}
          </Link>
        ) : (
          <span className="block truncate">{track.artist || t("unknownArtist")}</span>
        )}
      </td>

      <td className={CELL}>
        <div className="flex min-w-0 items-center gap-1.5">
          {isGuest && (
            <span className="shrink-0 rounded bg-default/70 px-1 text-[0.625rem] font-semibold uppercase">
              {t("artists.guest")}
            </span>
          )}
          {albumLink ? (
            <Link to={albumLink} className={CELL_LINK}>
              {track.album}
            </Link>
          ) : (
            <span className="block truncate">{t("metadata.emptyValue")}</span>
          )}
        </div>
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
          <RowActions onInspect={onInspect} onDelete={onDelete} onAddToPlaylist={onAddToPlaylist} />
        </div>
      </td>
    </tr>
  );
}
