import { useTranslation } from "react-i18next";

import { InspectRow } from "@/features/library/inspect/InspectRow";
import type { TrackListingProps } from "@/features/library/tracks/listing";
import type { TrackSortKey } from "@/features/library/tracks/sort";
import { SortableColumn } from "@/features/library/tracks/SortableColumn";
import { INSPECT_ROW_HEIGHT, useRowWindow } from "@/features/library/tracks/useRowWindow";
import { useTrackAttention } from "@/features/library/triage/attention";

/* No `uppercase`, unlike the reading table's: a sortable header renders its
 * label inside a button, and the UA stylesheet resets `text-transform` on form
 * elements — so half this row would have shouted and the other half not. */
const COLUMN = "px-2 pb-1.5 text-[0.625rem] font-semibold tracking-wide text-muted";

/**
 * The same list, laid out to be audited rather than listened to.
 *
 * Everything the correction queue can ask about is a column, so the answer to
 * "which track has no year" is a glance down one column instead of opening
 * seven drawers. Density is the whole point: no covers, no hover actions but
 * the one that fixes things, half the row height — three times as many rows on
 * screen, and a hole is a lit cell in a grid rather than a sentence to read.
 *
 * Amber comes from the very predicates the Metadata page counts (see
 * `useTrackAttention`), so a cell is lit here exactly when that page would still
 * name it — turning a check off, or answering "c'est voulu", puts the light out
 * everywhere at once.
 */
interface InspectTableProps extends TrackListingProps {
  /** Drops the Album column. One record's tracklist would otherwise spend a
   * seventh of its width repeating the title in the header above it — and the
   * whole argument for this table is that the width goes to the fields you came
   * to check. It is the only thing that differs between the two surfaces, which
   * is why it is a flag and not a second table. */
  insideAlbum?: boolean;
}

export function InspectTable({
  tracks,
  animationKey,
  sort,
  onSort,
  onPlay,
  onEdit,
  insideAlbum = false,
}: InspectTableProps) {
  const { t } = useTranslation("library");
  const rowWindow = useRowWindow(tracks, INSPECT_ROW_HEIGHT);
  const attention = useTrackAttention(tracks);

  const column = (key: TrackSortKey, label: string, className: string) =>
    onSort ? (
      <SortableColumn column={key} label={label} className={className} sort={sort} onSort={onSort} />
    ) : (
      <th className={className}>{label}</th>
    );

  return (
    <div className="overflow-x-auto">
      {/* No vertical spacing between rows, unlike the reading table: the zebra
       * needs to run edge to edge to be readable, and a gap would break it into
       * floating bands. */}
      <table
        className={
          "w-full table-fixed border-separate border-spacing-y-0 " + (insideAlbum ? "min-w-[44rem]" : "min-w-[58rem]")
        }
      >
        <thead>
          <tr className="[&>th]:border-b [&>th]:border-separator/60">
            <th className={`${COLUMN} w-12 text-right`}>{t("columns.number")}</th>
            {column("title", t("columns.title"), `${COLUMN} text-left`)}
            {/* Wider inside an album, which is where the freed Album column's
                share goes: left on the flexible title it only opened a gulf
                between a track's name and its credit. */}
            {column("artist", t("columns.artist"), `${COLUMN} ${insideAlbum ? "w-[24%]" : "w-[15%]"} text-left`)}
            {!insideAlbum && column("album", t("columns.album"), `${COLUMN} w-[15%] text-left`)}
            <th className={`${COLUMN} w-14 text-right`}>{t("columns.year")}</th>
            {column("genre", t("columns.genre"), `${COLUMN} w-[13%] text-left`)}
            <th className={`${COLUMN} w-[12%] text-left`}>{t("columns.category")}</th>
            {column("length", t("columns.duration"), `${COLUMN} w-14 text-right`)}
            <th className={`${COLUMN} w-10`}>
              <span className="sr-only">{t("columns.attention")}</span>
            </th>
            <th className={`${COLUMN} w-9`}>
              <span className="sr-only">{t("columns.actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody key={animationKey}>
          {rowWindow.paddingTop > 0 && <tr style={{ height: rowWindow.paddingTop }} aria-hidden />}

          {rowWindow.rows.map(({ track, index }) => (
            <InspectRow
              key={track.id}
              track={track}
              index={index}
              insideAlbum={insideAlbum}
              flags={attention.get(track.id) ?? []}
              onPlay={() => onPlay(index)}
              onEdit={() => onEdit(track)}
            />
          ))}

          {rowWindow.paddingBottom > 0 && <tr style={{ height: rowWindow.paddingBottom }} aria-hidden />}
        </tbody>
      </table>
    </div>
  );
}
