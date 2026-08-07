import { type CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Album } from "@/features/library/albums/albums";
import { AlbumTrackRow } from "@/features/library/albums/AlbumTrackRow";
import type { LibraryTrack } from "@/features/library/api";
import { DeleteTrackDialog } from "@/features/library/DeleteTrackDialog";
import { MetadataDrawer } from "@/features/library/MetadataDrawer";
import { AddToPlaylistDialog } from "@/features/library/playlists/AddToPlaylistDialog";
import { nextSort, sortTracks, type TrackSort, type TrackSortKey } from "@/features/library/tracks/sort";
import { SortableColumn } from "@/features/library/tracks/SortableColumn";
import { usePlayQueue } from "@/features/library/usePlayQueue";

// No alignment in the base: `${COLUMN} text-center` looks like it wins, but
// Tailwind resolves conflicts by stylesheet order, not by class-string order,
// so a `text-left` baked in here silently beat the "#" column's override.
const COLUMN = "px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted";

/**
 * Deliberately not `TrackTable`: an album's tracklist drops the Album column
 * (album-level, already in the header), keeps its own fixed order, and carries
 * a per-track tag score the library-wide table has no room for. Genre used to
 * be dropped on the same "album-level" reasoning — until a record legitimately
 * mixed genres (the Spirit soundtrack), which is exactly what the album view
 * would then hide. Bending one table to cover both shapes would have meant a
 * variant prop toggling four columns.
 */
export function AlbumTrackList({ album }: { album: Album }) {
  const { t } = useTranslation("library");
  const [inspectedId, setInspectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<LibraryTrack | null>(null);
  const [addingToPlaylist, setAddingToPlaylist] = useState<LibraryTrack[] | null>(null);
  // A way of reading the record, not a change to it: the album keeps its own
  // order, and dropping the sort (third click) returns to it.
  const [sort, setSort] = useState<TrackSort | null>(null);
  const { playFrom } = usePlayQueue();

  const visible = sortTracks(album.tracks, sort);

  // Derived from the live album, so a re-enrich refetch updates the open drawer.
  const inspected = inspectedId != null ? (album.tracks.find((track) => track.id === inspectedId) ?? null) : null;

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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] table-fixed border-separate border-spacing-y-0.5">
          <thead>
            <tr className="[&>th]:border-b [&>th]:border-separator/60">
              <th className={`${COLUMN} w-14 text-center`}>#</th>
              {column("title", t("columns.title"), `${COLUMN} text-left`)}
              {column("artist", t("columns.artist"), `${COLUMN} w-[22%] text-left`)}
              {column("genre", t("columns.genre"), `${COLUMN} w-[16%] text-left`)}
              <th className={`${COLUMN} w-20 text-left`}>{t("columns.tags")}</th>
              {column("length", t("columns.duration"), `${COLUMN} w-16 text-right`)}
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
                style={{ "--row-stagger": `${Math.min(position, 10) * 0.025}s` } as CSSProperties}
                // The visible order is the playback context, sort included —
                // same contract as the library-wide table.
                onPlay={() => playFrom(visible, position)}
                onInspect={() => setInspectedId(track.id)}
                onDelete={() => setDeleting(track)}
                onAddToPlaylist={() => setAddingToPlaylist([track])}
              />
            ))}
          </tbody>
        </table>
      </div>

      <MetadataDrawer track={inspected} onClose={() => setInspectedId(null)} />
      <DeleteTrackDialog track={deleting} onClose={() => setDeleting(null)} />
      <AddToPlaylistDialog tracks={addingToPlaylist} onClose={() => setAddingToPlaylist(null)} />
    </>
  );
}
