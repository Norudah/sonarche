import { useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

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
import { useRowWindow } from "@/features/library/tracks/useRowWindow";
import { usePlayQueue } from "@/features/library/usePlayQueue";

const COLUMN = "px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted";

/** Handed to the windowing hook while the inspection table is the one on screen:
 * this table is not rendered then, so it has nothing to window. Same idiom as
 * `useDragReorder(0, …)` below — a disabled hook is told so with its own
 * argument rather than skipped, which hooks forbid. */
const NOT_RENDERED: LibraryTrack[] = [];

interface PlaylistTrackListProps {
  playlistId: number;
  /** Members resolved against the library, in playlist order. */
  tracks: LibraryTrack[];
}

/**
 * The playlist's body. Windowed like the library-wide table (a playlist has no
 * size ceiling), with the one thing no other table has: rows that can be
 * picked up and reordered — the order *is* the data here, where every other
 * list's order is a view.
 */
export function PlaylistTrackList({ playlistId, tracks }: PlaylistTrackListProps) {
  const { t } = useTranslation("library");
  const [inspectedId, setInspectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<LibraryTrack | null>(null);
  const [addingToPlaylist, setAddingToPlaylist] = useState<LibraryTrack[] | null>(null);
  // A way of *reading* the list; the stored order is untouched, and every
  // mutation below addresses the row's original position through the view.
  const [sort, setSort] = useState<TrackSort | null>(null);
  const { playFrom } = usePlayQueue();
  const move = useMovePlaylistTrack();
  const remove = useRemoveFromPlaylist();

  const inspecting = useLensHere();

  const view = playlistView(tracks, sort);
  const visibleTracks = sort == null ? tracks : view.map((row) => row.track);
  const rowWindow = useRowWindow(inspecting ? NOT_RENDERED : visibleTracks);
  // Sorted, the display order and the stored order disagree, so a drag would
  // lie about what it moves: reordering exists only in the list's own order.
  const canReorder = sort == null;
  const { drag, handleProps, rowStyle } = useDragReorder(canReorder ? tracks.length : 0, (from, to) =>
    move.mutate({ id: playlistId, from, to }),
  );

  const inspected = inspectedId != null ? (tracks.find((track) => track.id === inspectedId) ?? null) : null;

  const column = (key: TrackSortKey, label: string, className: string) => (
    <SortableColumn
      column={key}
      label={label}
      className={className}
      sort={sort}
      onSort={(clicked) => setSort(nextSort(sort, clicked))}
    />
  );

  return (
    <>
      {inspecting ? (
        // No drag handle and no remove: under the lens this is a list of tags
        // to check, and reordering a playlist is not something you do while
        // looking for a missing year. Both come back with the switch.
        <InspectTable
          tracks={visibleTracks}
          animationKey={String(playlistId)}
          sort={sort}
          onSort={(clicked) => setSort(nextSort(sort, clicked))}
          onPlay={(index) => playFrom(visibleTracks, index)}
          onEdit={(track) => setInspectedId(track.id)}
          onDelete={setDeleting}
          onAddToPlaylist={(track) => setAddingToPlaylist([track])}
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
                {column("title", t("columns.title"), `${COLUMN} text-left`)}
                {column("artist", t("columns.artist"), `${COLUMN} w-[18%] text-left`)}
                {column("album", t("columns.album"), `${COLUMN} w-[18%] text-left`)}
                {column("length", t("columns.duration"), `${COLUMN} w-16 text-right`)}
                <th className={`${COLUMN} w-36`}>
                  <span className="sr-only">{t("columns.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rowWindow.paddingTop > 0 && <tr style={{ height: rowWindow.paddingTop }} aria-hidden />}

              {rowWindow.rows.map(({ track, index }) => (
                <PlaylistTrackRow
                  // The id is unique here by construction: additions dedup, so a
                  // track can never sit in one playlist twice.
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
    </>
  );
}
