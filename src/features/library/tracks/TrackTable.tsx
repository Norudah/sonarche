import { ArrowDown, ArrowUp } from "lucide-react";
import { type CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { DeleteTrackDialog } from "@/features/library/DeleteTrackDialog";
import { MetadataDrawer } from "@/features/library/MetadataDrawer";
import type { TrackSort, TrackSortKey } from "@/features/library/tracks/sort";
import { TrackRow } from "@/features/library/tracks/TrackRow";
import { useRowWindow } from "@/features/library/tracks/useRowWindow";
import { useTopOnFilterChange } from "@/features/library/tracks/useTopOnFilterChange";
import { usePlayQueue } from "@/features/library/usePlayQueue";

// No alignment in the base: Tailwind resolves conflicts by stylesheet order,
// not by class-string order, so a `text-left` baked in here silently beats a
// per-column `text-center` override (see the album tracklist's own note).
const COLUMN = "px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted";

interface TrackTableProps {
  tracks: LibraryTrack[];
  /**
   * What the current result set is a result *of* — the search query, the
   * selected genre. A change re-keys the body, which replays the row cascade:
   * filtered results flow in instead of snapping into place. Same CSS-animation
   * approach as the download queue (see `row-cascade` in theme.css).
   */
  animationKey?: string;
  /** Active ordering, or null for the library's own. Absent on the tables that
   * are not a queryable list — an artist's guest spots, a genre's fallback. */
  sort?: TrackSort | null;
  /** A column header was clicked. Absent means the headers are plain labels. */
  onSort?: (key: TrackSortKey) => void;
  /** Album artist of the surrounding page, when it has one. */
  guestOwner?: string;
}

/**
 * A column header that orders the list.
 *
 * The control belongs to the thing it orders: a table has headers, so it sorts
 * from them, while the album and artist shelves — grids, with no headers to
 * click — keep their `SortSelect`. Two idioms, each where it is the obvious one.
 */
function SortableColumn({
  column,
  label,
  className,
  sort,
  onSort,
}: {
  column: TrackSortKey;
  label: string;
  className: string;
  sort: TrackSort | null;
  onSort: (key: TrackSortKey) => void;
}) {
  const { t } = useTranslation("library");
  const isActive = sort?.key === column;
  const Arrow = sort?.dir === "desc" ? ArrowDown : ArrowUp;

  return (
    <th
      className={className}
      // The live ordering for a screen reader, which cannot see the arrow.
      aria-sort={isActive ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={t("sort.byColumn", { column: label })}
        className={
          "inline-flex cursor-pointer items-center gap-1 rounded outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 " +
          (isActive ? "text-accent" : "hover:text-foreground")
        }
      >
        {label}
        {/* The slot is held empty so a column does not widen when it becomes the
         * sorted one — which shifted every header to its right. */}
        <span className="flex w-3 justify-center">{isActive && <Arrow className="size-3" />}</span>
      </button>
    </th>
  );
}

export function TrackTable({ tracks, animationKey = "", sort = null, onSort, guestOwner }: TrackTableProps) {
  const { t } = useTranslation("library");
  const [inspectedId, setInspectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<LibraryTrack | null>(null);
  const { playFrom } = usePlayQueue();
  const rowWindow = useRowWindow(tracks);
  useTopOnFilterChange(animationKey);

  // Derive from the live list, not a snapshot: re-enrich mutates the track and
  // the drawer must show the new album/artwork after the query refetches.
  const inspected = inspectedId != null ? (tracks.find((t) => t.id === inspectedId) ?? null) : null;

  const column = (key: TrackSortKey, label: string, className: string) =>
    onSort ? (
      <SortableColumn column={key} label={label} className={className} sort={sort} onSort={onSort} />
    ) : (
      <th className={className}>{label}</th>
    );

  return (
    <>
      {/* `table-fixed` splits the leftover width across five sized columns, so
       * below a certain width the flexible Titre column collapses to nothing —
       * artwork and title vanish before anything else does. A min-width plus a
       * scroll container makes the table squeeze to a floor, then scroll. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] table-fixed border-separate border-spacing-y-0.5">
          <thead>
            <tr className="[&>th]:border-b [&>th]:border-separator/60">
              <th className={`${COLUMN} w-14 text-center`}>#</th>
              {column("title", t("columns.title"), `${COLUMN} text-left`)}
              {column("artist", t("columns.artist"), `${COLUMN} w-[18%] text-left`)}
              {column("album", t("columns.album"), `${COLUMN} w-[18%] text-left`)}
              {column("genre", t("columns.genre"), `${COLUMN} w-32 text-left`)}
              {column("length", t("columns.duration"), `${COLUMN} w-16 text-right`)}
              <th className={`${COLUMN} w-28`}>
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
                // The visible list is the row's playback context: what plays
                // next is what the user is looking at, filters included.
                onPlay={() => playFrom(tracks, index)}
                onInspect={() => setInspectedId(track.id)}
                onDelete={() => setDeleting(track)}
              />
            ))}

            {rowWindow.paddingBottom > 0 && <tr style={{ height: rowWindow.paddingBottom }} aria-hidden />}
          </tbody>
        </table>
      </div>

      <MetadataDrawer track={inspected} onClose={() => setInspectedId(null)} />
      <DeleteTrackDialog track={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
