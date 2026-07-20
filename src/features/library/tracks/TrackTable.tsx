import { type CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { DeleteTrackDialog } from "@/features/library/DeleteTrackDialog";
import { MetadataDrawer } from "@/features/library/MetadataDrawer";
import { TrackRow } from "@/features/library/tracks/TrackRow";
import { useRowWindow } from "@/features/library/tracks/useRowWindow";
import { useTopOnFilterChange } from "@/features/library/tracks/useTopOnFilterChange";

const COLUMN = "px-3 pb-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-muted";

interface TrackTableProps {
  tracks: LibraryTrack[];
  /**
   * What the current result set is a result *of* — the search query, the
   * selected genre. A change re-keys the body, which replays the row cascade:
   * filtered results flow in instead of snapping into place. Same CSS-animation
   * approach as the download queue (see `row-cascade` in theme.css).
   */
  animationKey?: string;
}

export function TrackTable({ tracks, animationKey = "" }: TrackTableProps) {
  const { t } = useTranslation("library");
  const [inspectedId, setInspectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<LibraryTrack | null>(null);
  const rowWindow = useRowWindow(tracks);
  useTopOnFilterChange(animationKey);

  // Derive from the live list, not a snapshot: re-enrich mutates the track and
  // the drawer must show the new album/artwork after the query refetches.
  const inspected = inspectedId != null ? (tracks.find((t) => t.id === inspectedId) ?? null) : null;

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
              <th className={`${COLUMN} w-14`}>#</th>
              <th className={COLUMN}>{t("columns.title")}</th>
              <th className={`${COLUMN} w-[18%]`}>{t("columns.artist")}</th>
              <th className={`${COLUMN} w-[18%]`}>{t("columns.album")}</th>
              <th className={`${COLUMN} w-32`}>{t("columns.genre")}</th>
              <th className={`${COLUMN} w-16 text-right`}>{t("columns.duration")}</th>
              <th className={`${COLUMN} w-20`}>
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
                onInspect={() => setInspectedId(track.id)}
                onDelete={() => setDeleting(track)}
              />
            ))}

            {rowWindow.paddingBottom > 0 && <tr style={{ height: rowWindow.paddingBottom }} aria-hidden />}
          </tbody>
        </table>
      </div>

      <MetadataDrawer track={inspected} onClose={() => setInspectedId(null)} onDelete={setDeleting} />
      <DeleteTrackDialog track={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
