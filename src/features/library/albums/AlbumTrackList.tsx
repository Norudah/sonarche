import { motion } from "motion/react";
import { type CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Album } from "@/features/library/albums/albums";
import { AlbumTrackRow } from "@/features/library/albums/AlbumTrackRow";
import { MoveToAlbumDialog } from "@/features/library/albums/MoveToAlbumDialog";
import type { LibraryTrack } from "@/features/library/api";
import { DeleteTrackDialog } from "@/features/library/DeleteTrackDialog";
import { MetadataDrawer } from "@/features/library/MetadataDrawer";
import { useLensHere } from "@/features/library/inspect/inspectMode";
import { InspectTable } from "@/features/library/inspect/InspectTable";
import { AddToPlaylistDialog } from "@/features/library/playlists/AddToPlaylistDialog";
import type { TrackSortKey } from "@/features/library/tracks/sort";
import { useAlbumAttention } from "@/features/library/triage/attention";
import { SortableColumn } from "@/features/library/tracks/SortableColumn";
import { HEADER, NUMERIC, PAD } from "@/features/library/tracks/tableGrid";
import type { TrackFilterState } from "@/features/library/tracks/useTrackFilter";
import { usePlayQueue } from "@/features/library/usePlayQueue";
import { fade } from "@/shared/motion/tokens";

// No alignment in the base: `${COLUMN} text-center` looks like it wins, but
// Tailwind resolves conflicts by stylesheet order, not by class-string order,
// so a `text-left` baked in here silently beat the "#" column's override.
const COLUMN = `${PAD} ${HEADER}`;

/**
 * Deliberately not `TrackTable`: an album's tracklist drops the Album column
 * (album-level, already in the header), keeps its own fixed order, and carries
 * a per-track attention dot the library-wide table has no room for. Genre used to
 * be dropped on the same "album-level" reasoning — until a record legitimately
 * mixed genres (the Spirit soundtrack), which is exactly what the album view
 * would then hide. Bending one table to cover both shapes would have meant a
 * variant prop toggling four columns.
 *
 * The inspection table below is the exception that proves it: there, the two
 * surfaces differ by exactly one column, because the whole point of that table
 * is that every field has the same place on every page.
 */
export function AlbumTrackList({ album, state }: { album: Album; state: TrackFilterState }) {
  const { t } = useTranslation("library");
  const [inspectedId, setInspectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<LibraryTrack | null>(null);
  const [addingToPlaylist, setAddingToPlaylist] = useState<LibraryTrack[] | null>(null);
  const [moving, setMoving] = useState<LibraryTrack[] | null>(null);
  // Sort, search and filters all live in the page's explorer now, so the hero's
  // play button queues exactly what the list shows. They stay ways of *reading*
  // the record: the album keeps its own order, and dropping the sort (third
  // click on a header) returns to it.
  const { visible, sort, toggleSort, query, scopeSize } = state;
  const { playFrom } = usePlayQueue();
  const inspecting = useLensHere();
  // The Metadata page's verdict, narrowed to this record: a row is dotted here
  // exactly when that page would still name it. (Under the lens the inspection
  // table asks for its own, over the same predicates.)
  const attention = useAlbumAttention(album);

  // Derived from the live album, so a re-enrich refetch updates the open drawer.
  const inspected = inspectedId != null ? (album.tracks.find((track) => track.id === inspectedId) ?? null) : null;

  const column = (key: TrackSortKey, label: string, className: string, align?: "left" | "right") => (
    <SortableColumn column={key} label={label} className={className} align={align} sort={sort} onSort={toggleSort} />
  );

  return (
    <>
      {visible.length === 0 && scopeSize > 0 ? (
        // Filtered or searched down to nothing. Fades in rather than replacing
        // the table in one frame — the search is live, so this state appears
        // mid-keystroke. Standing here rather than in an early return so the
        // dialogs below stay mounted whatever the list is showing.
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fade}
          className="py-16 text-center text-sm text-muted"
        >
          {query ? t("search.noResults", { query }) : t("triage.noResults")}
        </motion.p>
      ) : inspecting ? (
        // The record's own tracklist under the lens. Same table as the
        // explorer's, minus the Album column: on a page whose header is the
        // album, that column would repeat one title down the whole list.
        <InspectTable
          insideAlbum
          tracks={visible}
          animationKey={album.key}
          sort={sort}
          onSort={toggleSort}
          onPlay={(index) => playFrom(visible, index)}
          onEdit={(track) => setInspectedId(track.id)}
          onDelete={setDeleting}
          onAddToPlaylist={(track) => setAddingToPlaylist([track])}
          onMoveToAlbum={(track) => setMoving([track])}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] table-fixed border-separate border-spacing-y-0.5">
            <thead>
              <tr className="[&>th]:border-b [&>th]:border-separator/60">
                <th className={`${COLUMN} w-14 text-center`}>#</th>
                {column("title", t("columns.title"), COLUMN)}
                {column("artist", t("columns.artist"), `${COLUMN} w-[22%]`)}
                {column("genre", t("columns.genre"), `${COLUMN} w-[16%]`)}
                {/* No visible label: the column holds a dot, and a header over an
                  empty cell is a promise of content that settled rows do not
                  owe. */}
                <th className={`${COLUMN} w-8`}>
                  <span className="sr-only">{t("columns.attention")}</span>
                </th>
                {column("length", t("columns.duration"), `${COLUMN} w-20 ${NUMERIC}`, "right")}
                <th className={`${COLUMN} w-36`}>
                  <span className="sr-only">{t("columns.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody key={album.key}>
              {visible.map((track, position) => (
                <AlbumTrackRow
                  key={track.id}
                  track={track}
                  position={position + 1}
                  flags={attention.get(track.id) ?? []}
                  style={{ "--row-stagger": `${Math.min(position, 10) * 0.025}s` } as CSSProperties}
                  // The visible order is the playback context, sort included —
                  // same contract as the library-wide table.
                  onPlay={() => playFrom(visible, position)}
                  onEdit={() => setInspectedId(track.id)}
                  onDelete={() => setDeleting(track)}
                  onAddToPlaylist={() => setAddingToPlaylist([track])}
                  onMoveToAlbum={() => setMoving([track])}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MetadataDrawer track={inspected} onClose={() => setInspectedId(null)} />
      <DeleteTrackDialog track={deleting} onClose={() => setDeleting(null)} />
      <AddToPlaylistDialog tracks={addingToPlaylist} onClose={() => setAddingToPlaylist(null)} />
      <MoveToAlbumDialog tracks={moving} onClose={() => setMoving(null)} />
    </>
  );
}
