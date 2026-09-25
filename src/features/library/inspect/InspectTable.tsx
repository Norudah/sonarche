import { useTranslation } from "react-i18next";

import { InspectRow } from "@/features/library/inspect/InspectRow";
import type { TrackListingProps } from "@/features/library/tracks/listing";
import type { TrackSortKey } from "@/features/library/tracks/sort";
import { SortableColumn } from "@/features/library/tracks/SortableColumn";
import { HEADER, NUMERIC, PAD } from "@/features/library/tracks/tableGrid";
import { INSPECT_ROW_HEIGHT, useRowWindow } from "@/features/library/tracks/useRowWindow";
import { useTrackAttention } from "@/features/library/triage/attention";

/* Same header as the reading table; density comes from the rows. */
const COLUMN = `${PAD} ${HEADER}`;

/** The list laid out for auditing: one column per checked field, no covers,
 * half-height rows. Cells light from the Metadata page's predicates
 * (`useTrackAttention`), so both always agree. */
interface InspectTableProps extends TrackListingProps {
  /** Drops the Album column inside an album page. */
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

  const column = (key: TrackSortKey, label: string, className: string, align?: "left" | "right") =>
    onSort ? (
      <SortableColumn column={key} label={label} className={className} align={align} sort={sort} onSort={onSort} />
    ) : (
      <th className={`${className} ${align === "right" ? "text-right" : "text-left"}`}>{label}</th>
    );

  return (
    <div className="overflow-x-auto">
      {/* No row spacing, so the zebra runs edge to edge. */}
      <table
        className={
          "w-full table-fixed border-separate border-spacing-y-0 " + (insideAlbum ? "min-w-[64rem]" : "min-w-[80rem]")
        }
      >
        <thead>
          <tr className="[&>th]:border-b [&>th]:border-separator/60">
            <th className={`${COLUMN} w-14 ${NUMERIC} text-right`}>{t("columns.number")}</th>
            {column("title", t("columns.title"), COLUMN)}
            {/* Wider inside an album, taking the Album column's share. */}
            {column("artist", t("columns.artist"), `${COLUMN} ${insideAlbum ? "w-[20%]" : "w-[14%]"}`)}
            {!insideAlbum && column("album", t("columns.album"), `${COLUMN} w-[14%]`)}
            <th className={`${COLUMN} w-20 ${NUMERIC} text-right`}>{t("columns.year")}</th>
            {column("genre", t("columns.genre"), `${COLUMN} w-[12%]`)}
            {/* Next to the genre it derives from, so off-tree genres can be checked. */}
            <th className={`${COLUMN} w-[10%] text-left`}>{t("columns.family")}</th>
            <th className={`${COLUMN} w-[12%] text-left`}>{t("columns.category")}</th>
            {column("length", t("columns.duration"), `${COLUMN} w-20 ${NUMERIC}`, "right")}
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
