import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { albumPath, artistPath } from "@/app/routes";
import type { LibraryTrack } from "@/features/library/api";
import { extensionOf, unplayableTest, usePlayableExtensions } from "@/features/library/playable";
import { ActionHelp } from "@/shared/ui/FieldHelp";
import { rowPlayHandler } from "@/features/library/tracks/rowPlay";
import { RowActions } from "@/features/library/tracks/RowActions";
import { NUMERIC, PAD } from "@/features/library/tracks/tableGrid";
import { TrackIndexCell } from "@/features/library/tracks/TrackIndexCell";
import { formatDuration } from "@/shared/lib/format";
import { usePlayer } from "@/shared/player/PlayerContext";
import { TrackThumb } from "@/shared/ui/TrackThumb";

const CELL = `${PAD} py-2 text-[0.8125rem] text-muted`;

/* Underlined on hover only. */
const CELL_LINK = "block truncate outline-none hover:text-foreground hover:underline focus-visible:text-foreground";

interface TrackRowProps {
  track: LibraryTrack;
  index: number;
  /** Off when windowed: rows would re-animate on scroll. */
  cascade?: boolean;
  style?: CSSProperties;
  /** The page's album artist; other rows are guest spots. */
  guestOwner?: string;
  /** The table decides the queue. */
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddToPlaylist: () => void;
  onMoveToAlbum: () => void;
}

export function TrackRow({
  track,
  index,
  cascade = true,
  style,
  guestOwner,
  onPlay,
  onEdit,
  onDelete,
  onAddToPlaylist,
  onMoveToAlbum,
}: TrackRowProps) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");
  const { current, isPlaying } = usePlayer();
  const isCurrent = current?.id === track.id;

  // Album artist, else the track artist; used for routes and the guest test.
  const owner = track.albumArtist.trim() || track.artist.trim();
  // Artist pages exist per album artist, so a featuring credit isn't a link.
  const artistLink = owner === track.artist.trim() && owner !== "" ? artistPath(owner) : null;
  const albumLink = track.album.trim() !== "" ? albumPath(owner, track.album) : null;
  const isGuest = guestOwner != null && owner !== guestOwner;
  const isUnplayable = unplayableTest(usePlayableExtensions().data)(track);

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
        {/* Centred under the "#" header. */}
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
          {/* Lazy: one cover per row across the whole library. */}
          <TrackThumb artUrl={track.artUrl} />
          <span
            className={
              "truncate text-sm font-medium transition-colors " + (isCurrent ? "text-accent" : "text-foreground")
            }
          >
            {track.title || t("unknownTitle")}
          </span>
          {/* Imported but undecodable: flagged before anyone presses play. */}
          {isUnplayable && (
            <ActionHelp text={t("unplayable.why", { format: extensionOf(track.path).toUpperCase() })}>
              <span className="shrink-0 rounded bg-warning-soft px-1 text-[0.625rem] font-semibold text-warning uppercase">
                {t("unplayable.badge")}
              </span>
            </ActionHelp>
          )}
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
        {/* Amber: incomplete metadata. */}
        <span
          className={
            "inline-block max-w-full truncate rounded-md px-2 py-0.5 text-[0.6875rem] " +
            (track.genre ? "bg-default/70 text-foreground" : "bg-warning-soft text-warning")
          }
        >
          {track.genre ?? t("genres.none")}
        </span>
      </td>

      {/* A span: the row cascade animates child elements, not text nodes. */}
      <td className={`${CELL} w-20 ${NUMERIC} text-right`}>
        <span className="block">{track.length != null ? formatDuration(track.length) : t("metadata.emptyValue")}</span>
      </td>

      {/* The wrapper takes `row-cascade`'s `td > *` animation, which would
          otherwise override the actions' idle opacity. */}
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
