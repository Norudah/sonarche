import type { LibraryTrack } from "@/features/library/api";
import type { TrackSort, TrackSortKey } from "@/features/library/tracks/sort";

/**
 * What a track list needs to draw itself, whichever way it is being looked at.
 *
 * Shared by the reading table and the inspection one so `TrackTable` can hand
 * the same object to either. The two differ in what they show, never in what
 * they are given: the list, its ordering, and the four things a row can do.
 *
 * Each table does its own windowing rather than being handed rows: the two have
 * different row heights, and one virtualizer shared across a height change
 * keeps the offsets it measured for the other.
 */
export interface TrackListingProps {
  tracks: LibraryTrack[];
  /** Re-keys the body, which replays the row cascade — see `TrackTable`. */
  animationKey: string;
  sort: TrackSort | null;
  /** Absent means the headers are plain labels, not sort controls. */
  onSort?: (key: TrackSortKey) => void;
  /** Album artist of the surrounding page, when it has one. */
  guestOwner?: string;
  /** Start playback at this position of the list. */
  onPlay: (index: number) => void;
  onEdit: (track: LibraryTrack) => void;
  onDelete: (track: LibraryTrack) => void;
  onAddToPlaylist: (track: LibraryTrack) => void;
  onMoveToAlbum: (track: LibraryTrack) => void;
}
