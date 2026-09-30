import { useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { MoveToAlbumDialog } from "@/features/library/albums/MoveToAlbumDialog";
import type { LibraryTrack } from "@/features/library/api";
import { DeleteTrackDialog } from "@/features/library/DeleteTrackDialog";
import { MetadataDrawer } from "@/features/library/MetadataDrawer";
import { useLensHere } from "@/features/library/inspect/inspectMode";
import { InspectTable } from "@/features/library/inspect/InspectTable";
import { AddToPlaylistDialog } from "@/features/library/playlists/AddToPlaylistDialog";
import { useMovePlaylistTrack, useRemoveFromPlaylist } from "@/features/library/playlists/hooks";
import { playlistView } from "@/features/library/playlists/playlists";
import { PlaylistTrackRow } from "@/features/library/playlists/PlaylistTrackRow";
import { useDragReorder } from "@/features/library/playlists/useDragReorder";
import { nextSort, type TrackSort, type TrackSortKey } from "@/features/library/tracks/sort";
import { SortableColumn } from "@/features/library/tracks/SortableColumn";
import { HEADER, NUMERIC, PAD } from "@/features/library/tracks/tableGrid";
import { useRowWindow } from "@/features/library/tracks/useRowWindow";
import { usePlayQueue } from "@/features/library/usePlayQueue";

const COLUMN = `${PAD} ${HEADER}`;

/** Passed to the windowing hook while the inspection table shows (hooks can't
 * be skipped, so the hook is told there's nothing to window). */
const NOT_RENDERED: LibraryTrack[] = [];

interface PlaylistTrackListProps {
  playlistId: number;
  /** Members in playlist order. */
  tracks: LibraryTrack[];
}

/** The playlist body: windowed, with drag reordering (here the order is the data). */
export function PlaylistTrackList({ playlistId, tracks }: PlaylistTrackListProps) {
  const { t } = useTranslation("library");
  const [inspectedId, setInspectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<LibraryTrack | null>(null);
  const [addingToPlaylist, setAddingToPlaylist] = useState<LibraryTrack[] | null>(null);
  // Playlists point at item ids, so moved tracks stay in the list.
  const [movingToAlbum, setMovingToAlbum] = useState<LibraryTrack[] | null>(null);
  // A view only; mutations address stored positions.
  const [sort, setSort] = useState<TrackSort | null>(null);
  const { playFrom } = usePlayQueue();
  const move = useMovePlaylistTrack();
  const remove = useRemoveFromPlaylist();

  const inspecting = useLensHere();

  const view = playlistView(tracks, sort);
  const visibleTracks = sort == null ? tracks : view.map((row) => row.track);
  const rowWindow = useRowWindow(inspecting ? NOT_RENDERED : visibleTracks);
  // Reordering only in the stored order.
  const canReorder = sort == null;
  const { drag, handleProps, rowStyle } = useDragReorder(canReorder ? tracks.length : 0, (from, to) =>
    move.mutate({ id: playlistId, from, to }),
  );

  const inspected = inspectedId != null ? (tracks.find((track) => track.id === inspectedId) ?? null) : null;

  const column = (key: TrackSortKey, label: string, className: string, align?: "left" | "right") => (
    <SortableColumn
      column={key}
      label={label}
      className={className}
      align={align}
      sort={sort}
      onSort={(clicked) => setSort(nextSort(sort, clicked))}
    />
  );

  return (
    <>
      {inspecting ? (
        // No drag handle or remove under the lens.
        <InspectTable
          tracks={visibleTracks}
          animationKey={String(playlistId)}
          sort={sort}
          onSort={(clicked) => setSort(nextSort(sort, clicked))}
          onPlay={(index) => playFrom(visibleTracks, index)}
          onEdit={(track) => setInspectedId(track.id)}
          onDelete={setDeleting}
          onAddToPlaylist={(track) => setAddingToPlaylist([track])}
          onMoveToAlbum={(track) => setMovingToAlbum([track])}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] table-fixed border-separate border-spacing-y-0.5">
            <thead>
              <tr className="[&>th]:border-b [&>th]:border-separator/60">
                <th className={`${COLUMN} w-8 px-1`}>
                  <span className="sr-only">{t("playlists.dragToReorder")}</span>
                </th>
                <th className={`${COLUMN} w-12 text-center`}>#</th>
                {column("title", t("columns.title"), COLUMN)}
                {column("artist", t("columns.artist"), `${COLUMN} w-[18%]`)}
                {column("album", t("columns.album"), `${COLUMN} w-[18%]`)}
                {column("length", t("columns.duration"), `${COLUMN} w-20 ${NUMERIC}`, "right")}
                <th className={`${COLUMN} w-36`}>
                  <span className="sr-only">{t("columns.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rowWindow.paddingTop > 0 && <tr style={{ height: rowWindow.paddingTop }} aria-hidden />}

              {rowWindow.rows.map(({ track, index }) => (
                <PlaylistTrackRow
                  // Unique: additions are deduplicated.
                  key={track.id}
                  track={track}
                  position={index}
                  canReorder={canReorder}
                  style={rowStyle(index) as CSSProperties | undefined}
                  isDragging={drag?.from === index}
                  dragHandleProps={handleProps(index)}
                  onPlay={() => playFrom(visibleTracks, index)}
                  onEdit={() => setInspectedId(track.id)}
                  onDelete={() => setDeleting(track)}
                  onRemoveFromPlaylist={() => remove.mutate({ id: playlistId, positions: [view[index].position] })}
                  onAddToPlaylist={() => setAddingToPlaylist([track])}
                  onMoveToAlbum={() => setMovingToAlbum([track])}
                />
              ))}

              {rowWindow.paddingBottom > 0 && <tr style={{ height: rowWindow.paddingBottom }} aria-hidden />}
            </tbody>
          </table>
        </div>
      )}

      <MetadataDrawer track={inspected} onClose={() => setInspectedId(null)} />
      <DeleteTrackDialog track={deleting} onClose={() => setDeleting(null)} />
      <AddToPlaylistDialog tracks={addingToPlaylist} onClose={() => setAddingToPlaylist(null)} />
      <MoveToAlbumDialog tracks={movingToAlbum} onClose={() => setMovingToAlbum(null)} />
    </>
  );
}
