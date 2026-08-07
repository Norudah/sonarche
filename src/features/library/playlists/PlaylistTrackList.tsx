import { useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { DeleteTrackDialog } from "@/features/library/DeleteTrackDialog";
import { MetadataDrawer } from "@/features/library/MetadataDrawer";
import { AddToPlaylistDialog } from "@/features/library/playlists/AddToPlaylistDialog";
import { useMovePlaylistTrack, useRemoveFromPlaylist } from "@/features/library/playlists/hooks";
import { PlaylistTrackRow } from "@/features/library/playlists/PlaylistTrackRow";
import { useDragReorder } from "@/features/library/playlists/useDragReorder";
import { useRowWindow } from "@/features/library/tracks/useRowWindow";
import { usePlayQueue } from "@/features/library/usePlayQueue";

const COLUMN = "px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted";

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
  const { playFrom } = usePlayQueue();
  const move = useMovePlaylistTrack();
  const remove = useRemoveFromPlaylist();
  const rowWindow = useRowWindow(tracks);
  const { drag, handleProps, rowStyle } = useDragReorder(tracks.length, (from, to) =>
    move.mutate({ id: playlistId, from, to }),
  );

  const inspected = inspectedId != null ? (tracks.find((track) => track.id === inspectedId) ?? null) : null;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] table-fixed border-separate border-spacing-y-0.5">
          <thead>
            <tr className="[&>th]:border-b [&>th]:border-separator/60">
              <th className={`${COLUMN} w-8 px-1`}>
                <span className="sr-only">{t("playlists.dragToReorder")}</span>
              </th>
              <th className={`${COLUMN} w-12 text-center`}>#</th>
              <th className={`${COLUMN} text-left`}>{t("columns.title")}</th>
              <th className={`${COLUMN} w-[18%] text-left`}>{t("columns.artist")}</th>
              <th className={`${COLUMN} w-[18%] text-left`}>{t("columns.album")}</th>
              <th className={`${COLUMN} w-16 text-right`}>{t("columns.duration")}</th>
              <th className={`${COLUMN} w-28`}>
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
                style={rowStyle(index) as CSSProperties | undefined}
                isDragging={drag?.from === index}
                dragHandleProps={handleProps(index)}
                onPlay={() => playFrom(tracks, index)}
                onInspect={() => setInspectedId(track.id)}
                onDelete={() => setDeleting(track)}
                onRemoveFromPlaylist={() => remove.mutate({ id: playlistId, positions: [index] })}
                onAddToPlaylist={() => setAddingToPlaylist([track])}
              />
            ))}

            {rowWindow.paddingBottom > 0 && <tr style={{ height: rowWindow.paddingBottom }} aria-hidden />}
          </tbody>
        </table>
      </div>

      <MetadataDrawer track={inspected} onClose={() => setInspectedId(null)} />
      <DeleteTrackDialog track={deleting} onClose={() => setDeleting(null)} />
      <AddToPlaylistDialog tracks={addingToPlaylist} onClose={() => setAddingToPlaylist(null)} />
    </>
  );
}
