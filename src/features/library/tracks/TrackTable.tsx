import { useState } from "react";

import { MoveToAlbumDialog } from "@/features/library/albums/MoveToAlbumDialog";
import type { LibraryTrack } from "@/features/library/api";
import { DeleteTrackDialog } from "@/features/library/DeleteTrackDialog";
import { useLensHere } from "@/features/library/inspect/inspectMode";
import { InspectTable } from "@/features/library/inspect/InspectTable";
import { MetadataDrawer } from "@/features/library/MetadataDrawer";
import { AddToPlaylistDialog } from "@/features/library/playlists/AddToPlaylistDialog";
import type { TrackListingProps } from "@/features/library/tracks/listing";
import { ReadTable } from "@/features/library/tracks/ReadTable";
import type { TrackSort, TrackSortKey } from "@/features/library/tracks/sort";
import { useTopOnFilterChange } from "@/features/library/tracks/useTopOnFilterChange";
import { usePlayQueue } from "@/features/library/usePlayQueue";

interface TrackTableProps {
  tracks: LibraryTrack[];
  /** What the result set is a result of; a change replays the row cascade
   * (`row-cascade` in theme.css). */
  animationKey?: string;
  /** Null for the library's own order; absent on non-queryable tables. */
  sort?: TrackSort | null;
  /** Absent: headers are plain labels. */
  onSort?: (key: TrackSortKey) => void;
  guestOwner?: string;
}

/** Reading or inspection table, plus the dialogs and drawer shared by both, so
 * switching lens keeps them open. */
export function TrackTable({ tracks, animationKey = "", sort = null, onSort, guestOwner }: TrackTableProps) {
  const [inspectedId, setInspectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<LibraryTrack | null>(null);
  const [addingToPlaylist, setAddingToPlaylist] = useState<LibraryTrack[] | null>(null);
  const [moving, setMoving] = useState<LibraryTrack[] | null>(null);
  const { playFrom } = usePlayQueue();
  const inspecting = useLensHere();
  useTopOnFilterChange(animationKey);

  // Derived from the live list, so a re-enrich updates the drawer.
  const inspected = inspectedId != null ? (tracks.find((track) => track.id === inspectedId) ?? null) : null;

  const listing: TrackListingProps = {
    tracks,
    animationKey,
    sort,
    onSort,
    guestOwner,
    // The visible list, filters included, is the playback context.
    onPlay: (index) => playFrom(tracks, index),
    onEdit: (track) => setInspectedId(track.id),
    onDelete: setDeleting,
    onAddToPlaylist: (track) => setAddingToPlaylist([track]),
    onMoveToAlbum: (track) => setMoving([track]),
  };

  return (
    <>
      {inspecting ? <InspectTable {...listing} /> : <ReadTable {...listing} />}

      <MetadataDrawer track={inspected} onClose={() => setInspectedId(null)} />
      <DeleteTrackDialog track={deleting} onClose={() => setDeleting(null)} />
      <AddToPlaylistDialog tracks={addingToPlaylist} onClose={() => setAddingToPlaylist(null)} />
      <MoveToAlbumDialog tracks={moving} onClose={() => setMoving(null)} />
    </>
  );
}
