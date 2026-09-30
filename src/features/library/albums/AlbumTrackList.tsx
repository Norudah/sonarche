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

// No alignment here: Tailwind resolves conflicts by stylesheet order, so a
// base `text-left` would beat a column's override.
const COLUMN = `${PAD} ${HEADER}`;

/** The album's own tracklist rather than `TrackTable`: no Album column, its
 * own order, and a per-track attention dot. */
export function AlbumTrackList({ album, state }: { album: Album; state: TrackFilterState }) {
  const { t } = useTranslation("library");
  const [inspectedId, setInspectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<LibraryTrack | null>(null);
  const [addingToPlaylist, setAddingToPlaylist] = useState<LibraryTrack[] | null>(null);
  const [moving, setMoving] = useState<LibraryTrack[] | null>(null);
  // Sort and filters come from the page's explorer, so play queues what's shown.
  // Dropping the sort returns to album order.
  const { visible, sort, toggleSort, query, scopeSize } = state;
  const { playFrom } = usePlayQueue();
  const inspecting = useLensHere();
  // Dotted exactly when the Metadata page would still name the track.
  const attention = useAlbumAttention(album);

  // Derived from the live album, so refetches update the open drawer.
  const inspected = inspectedId != null ? (album.tracks.find((track) => track.id === inspectedId) ?? null) : null;

  const column = (key: TrackSortKey, label: string, className: string, align?: "left" | "right") => (
    <SortableColumn column={key} label={label} className={className} align={align} sort={sort} onSort={toggleSort} />
  );

  return (
    <>
      {visible.length === 0 && scopeSize > 0 ? (
        // Kept here (not an early return) so the dialogs below stay mounted.
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fade}
          className="py-16 text-center text-sm text-muted"
        >
          {query ? t("search.noResults", { query }) : t("triage.noResults")}
        </motion.p>
      ) : inspecting ? (
        // The explorer's inspection table without the Album column.
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
                {/* No label: the column only holds a dot. */}
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
                  // The visible order, sort included, is the playback context.
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
