import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type { TrackListingProps } from "@/features/library/tracks/listing";
import type { TrackSortKey } from "@/features/library/tracks/sort";
import { SortableColumn } from "@/features/library/tracks/SortableColumn";
import { HEADER, NUMERIC, PAD } from "@/features/library/tracks/tableGrid";
import { TrackRow } from "@/features/library/tracks/TrackRow";
import { useRowWindow } from "@/features/library/tracks/useRowWindow";

// No alignment here: Tailwind resolves conflicts by stylesheet order.
const COLUMN = `${PAD} ${HEADER}`;

/** The default track list: cover, title, credits. Tag quality is the
 * inspection table's job. */
export function ReadTable({
  tracks,
  animationKey,
  sort,
  onSort,
  guestOwner,
  onPlay,
  onEdit,
  onDelete,
  onAddToPlaylist,
  onMoveToAlbum,
}: TrackListingProps) {
  const { t } = useTranslation("library");
  const rowWindow = useRowWindow(tracks);

  const column = (key: TrackSortKey, label: string, className: string, align?: "left" | "right") =>
    onSort ? (
      <SortableColumn column={key} label={label} className={className} align={align} sort={sort} onSort={onSort} />
    ) : (
      <th className={`${className} ${align === "right" ? "text-right" : "text-left"}`}>{label}</th>
    );

  return (
    // A min-width plus scrolling, or `table-fixed` collapses the title column first.
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] table-fixed border-separate border-spacing-y-0.5">
        <thead>
          <tr className="[&>th]:border-b [&>th]:border-separator/60">
            {/* Centred: the cell holds the play control, not a figure. */}
            <th className={`${COLUMN} w-14 text-center`}>#</th>
            {column("title", t("columns.title"), COLUMN)}
            {/* The title takes the rest; these widths cap it. */}
            {column("artist", t("columns.artist"), `${COLUMN} w-[19%]`)}
            {column("album", t("columns.album"), `${COLUMN} w-[19%]`)}
            {column("genre", t("columns.genre"), `${COLUMN} w-[13%]`)}
            {column("length", t("columns.duration"), `${COLUMN} w-20 ${NUMERIC}`, "right")}
            <th className={`${COLUMN} w-36`}>
              <span className="sr-only">{t("columns.actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody key={animationKey}>
          {/* Spacer rows stand in for unmounted rows (a positioned <tr> would break
              the table layout). */}
          {rowWindow.paddingTop > 0 && <tr style={{ height: rowWindow.paddingTop }} aria-hidden />}

          {rowWindow.rows.map(({ track, index }) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index + 1}
              // Windowed rows mount on scroll and would re-animate.
              cascade={!rowWindow.isVirtual}
              // Capped: only the top rows are on screen anyway.
              style={{ "--row-stagger": `${Math.min(index, 10) * 0.025}s` } as CSSProperties}
              guestOwner={guestOwner}
              onPlay={() => onPlay(index)}
              onEdit={() => onEdit(track)}
              onDelete={() => onDelete(track)}
              onAddToPlaylist={() => onAddToPlaylist(track)}
              onMoveToAlbum={() => onMoveToAlbum(track)}
            />
          ))}

          {rowWindow.paddingBottom > 0 && <tr style={{ height: rowWindow.paddingBottom }} aria-hidden />}
        </tbody>
      </table>
    </div>
  );
}
