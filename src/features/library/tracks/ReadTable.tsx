import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type { TrackListingProps } from "@/features/library/tracks/listing";
import type { TrackSortKey } from "@/features/library/tracks/sort";
import { SortableColumn } from "@/features/library/tracks/SortableColumn";
import { HEADER, NUMERIC, PAD } from "@/features/library/tracks/tableGrid";
import { TrackRow } from "@/features/library/tracks/TrackRow";
import { useRowWindow } from "@/features/library/tracks/useRowWindow";

// No alignment in the base: Tailwind resolves conflicts by stylesheet order,
// not by class-string order, so a `text-left` baked in here silently beats a
// per-column override.
const COLUMN = `${PAD} ${HEADER}`;

/**
 * The library's track list as you read it: cover, title, who and where, and
 * nothing about how well it is tagged.
 *
 * This is the default and the resting state of the app. What is missing from a
 * record is not drawn here at all — that is the inspection table's job, and
 * going there is a decision.
 */
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
    // `table-fixed` splits the leftover width across five sized columns, so
    // below a certain width the flexible Titre column collapses to nothing —
    // artwork and title vanish before anything else does. A min-width plus a
    // scroll container makes the table squeeze to a floor, then scroll.
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] table-fixed border-separate border-spacing-y-0.5">
        <thead>
          <tr className="[&>th]:border-b [&>th]:border-separator/60">
            {/* Centred, and the one exception to "quantities right": the cell
                below holds the play control, not a number — the digit is what
                it shows at rest. Right-aligning a 28px round target would put
                its digit 14px off the label naming it. */}
            <th className={`${COLUMN} w-14 text-center`}>#</th>
            {column("title", t("columns.title"), COLUMN)}
            {/* The title keeps whatever is left, so the others are what caps
                it: at 18% each the credits stayed short while the title opened
                a hand-span of nothing before them. */}
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
          {/* Spacer rows stand in for the rows above and below the window, so
           * the scrollbar reflects the whole list. Rows rather than a
           * transform: a positioned <tr> would break the table layout that
           * keeps the columns aligned. */}
          {rowWindow.paddingTop > 0 && <tr style={{ height: rowWindow.paddingTop }} aria-hidden />}

          {rowWindow.rows.map(({ track, index }) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index + 1}
              // The cascade only makes sense on a list that mounts once. When
              // windowed, rows mount on every scroll and would re-animate.
              cascade={!rowWindow.isVirtual}
              // Capped: a 300-track library must not take ten seconds to
              // unfold, and only the rows near the top are on screen anyway.
              style={{ "--row-stagger": `${Math.min(index, 10) * 0.025}s` } as CSSProperties}
              guestOwner={guestOwner}
              onPlay={() => onPlay(index)}
              onEdit={() => onEdit(track)}
              onDelete={() => onDelete(track)}
              onAddToPlaylist={() => onAddToPlaylist(track)}
            />
          ))}

          {rowWindow.paddingBottom > 0 && <tr style={{ height: rowWindow.paddingBottom }} aria-hidden />}
        </tbody>
      </table>
    </div>
  );
}
