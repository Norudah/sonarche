import { useState } from "react";

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
 * One list, two ways of looking at it — and everything a row can open.
 *
 * The dialogs, the play queue and the inspected track live here rather than in
 * either table: they are the same whichever lens is on, and switching lens must
 * not close a drawer or forget which track it was showing. The tables below own
 * only their columns.
 */
export function TrackTable({ tracks, animationKey = "", sort = null, onSort, guestOwner }: TrackTableProps) {
  const [inspectedId, setInspectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<LibraryTrack | null>(null);
  const [addingToPlaylist, setAddingToPlaylist] = useState<LibraryTrack[] | null>(null);
  const { playFrom } = usePlayQueue();
  const inspecting = useLensHere();
  useTopOnFilterChange(animationKey);

  // Derive from the live list, not a snapshot: re-enrich mutates the track and
  // the drawer must show the new album/artwork after the query refetches.
  const inspected = inspectedId != null ? (tracks.find((track) => track.id === inspectedId) ?? null) : null;

  const listing: TrackListingProps = {
    tracks,
    animationKey,
    sort,
    onSort,
    guestOwner,
    // The visible list is the row's playback context: what plays next is what
    // the user is looking at, filters included.
    onPlay: (index) => playFrom(tracks, index),
    onEdit: (track) => setInspectedId(track.id),
    onDelete: setDeleting,
    onAddToPlaylist: (track) => setAddingToPlaylist([track]),
  };

  return (
    <>
      {inspecting ? <InspectTable {...listing} /> : <ReadTable {...listing} />}

      <MetadataDrawer track={inspected} onClose={() => setInspectedId(null)} />
      <DeleteTrackDialog track={deleting} onClose={() => setDeleting(null)} />
      <AddToPlaylistDialog tracks={addingToPlaylist} onClose={() => setAddingToPlaylist(null)} />
    </>
  );
}
