import type { LibraryTrack } from "@/features/library/api";
import type { TrackSort, TrackSortKey } from "@/features/library/tracks/sort";

/** Props shared by the reading and inspection tables. Each windows its own
 * rows: their heights differ. */
export interface TrackListingProps {
  tracks: LibraryTrack[];
  /** See `TrackTable`. */
  animationKey: string;
  sort: TrackSort | null;
  /** Absent: headers are plain labels. */
  onSort?: (key: TrackSortKey) => void;
  guestOwner?: string;
  onPlay: (index: number) => void;
  onEdit: (track: LibraryTrack) => void;
  onDelete: (track: LibraryTrack) => void;
  onAddToPlaylist: (track: LibraryTrack) => void;
  onMoveToAlbum: (track: LibraryTrack) => void;
}
