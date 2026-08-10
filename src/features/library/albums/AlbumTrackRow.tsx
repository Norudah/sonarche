import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import type { DoorKey } from "@/features/library/triage/queue";
import { ATTENTION_LABEL } from "@/features/library/albums/attentionLabels";
import { rowPlayHandler } from "@/features/library/tracks/rowPlay";
import { RowActions } from "@/features/library/tracks/RowActions";
import { TrackIndexCell } from "@/features/library/tracks/TrackIndexCell";
import { formatDuration } from "@/shared/lib/format";
import { usePlayer } from "@/shared/player/PlayerContext";

const CELL = "px-3 py-2 text-[0.8125rem] text-muted";

/**
 * The only thing an album says about its own metadata, and it says it per row.
 *
 * A dot and nothing else. This column used to read "5/7", a score out of a
 * denominator inflated by fields that are never empty (title, artist, album all
 * come from the file), so "6/7" was really "the genre is missing" dressed as a
 * grade. And a settled row was awarded a green dot, which turns a tracklist
 * into a report card. Now a settled row shows nothing at all: absence is the
 * good news, and only what asks for you is drawn.
 *
 * Nothing summarises this at the record level any more — the hero carried a
 * gauge and it read as a verdict on music you came to listen to. What is wrong
 * with a record belongs where you went to fix it: the edit modals, which show
 * every field at once because that is their job, and the Metadata page.
 */
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
  /** Position in the album, used when beets never tagged a track number. */
  position: number;
  /** The checks still naming this track, from the album's own verdict. */
  flags: DoorKey[];
  style?: CSSProperties;
  /** Launch playback at this row, with the album as the queue. */
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddToPlaylist: () => void;
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

      {/* Same chip grammar as the library-wide table: amber when missing —
       * an album can legitimately mix genres, so the value is per-row data. */}
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
      <td className={`${CELL} w-36 pl-6`}>
        <div>
          <RowActions onEdit={onEdit} onDelete={onDelete} onAddToPlaylist={onAddToPlaylist} favoriteId={track.id} />
        </div>
      </td>
    </tr>
  );
}
