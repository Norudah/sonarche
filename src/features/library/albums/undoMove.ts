import { findAlbum, type Album } from "@/features/library/albums/albums";
import { canonicalAlbumId } from "@/features/library/albums/move";
import type { LibraryTrack, MoveSpec, TrackUpdate } from "@/features/library/api";

/**
 * Undoing a move is the same verb pointed back: every moved track goes to the
 * record its snapshot names, recreated if the move emptied it away. What the
 * verb cannot restore — the old positions, renumbered on the way in — comes
 * back as one ordinary metadata batch behind it.
 */

export interface MoveUndoPlan {
  /** One request per source record the tracks came from. */
  specs: MoveSpec[];
  /** Puts the old track numbers (and totals) back; the update path skips
   * whatever the move never touched. */
  restore: TrackUpdate[];
}

function artistOf(track: LibraryTrack): string {
  return track.albumArtist.trim() || track.artist.trim();
}

function asField(value: number | null): string {
  return value == null ? "" : String(value);
}

/**
 * The way back for `snapshot` (the moved tracks as they were *before* the
 * move), against the shelf as it stands now. Null when there is no way back —
 * a track that had no record has nowhere the verb could return it to.
 */
export function buildMoveUndo(snapshot: LibraryTrack[], currentAlbums: Album[]): MoveUndoPlan | null {
  if (snapshot.length === 0 || snapshot.some((track) => !track.album.trim())) return null;

  const groups = new Map<string, LibraryTrack[]>();
  for (const track of snapshot) {
    const key = `${artistOf(track)}␟${track.album}`;
    const group = groups.get(key);
    if (group) group.push(track);
    else groups.set(key, [track]);
  }

  const specs: MoveSpec[] = [];
  for (const group of groups.values()) {
    const title = group[0].album;
    const artist = artistOf(group[0]);
    // The source may have survived (a partial move) or died with its last
    // track; aiming at the surviving row rather than recreating one is what
    // keeps the undo from leaving a twin behind.
    const existing = findAlbum(currentAlbums, artist, title);
    const targetAlbumId = existing ? canonicalAlbumId(existing) : null;
    specs.push({
      itemIds: group.map((track) => track.id),
      ...(targetAlbumId != null ? { targetAlbumId } : { newAlbum: { album: title, albumartist: artist } }),
      // A recreated collection must come back as one; a surviving row kept its
      // own kind and re-stating it is a no-op.
      ...(group[0].albumKind === "collection" ? { kind: "collection" as const } : {}),
    });
  }

  return {
    specs,
    restore: snapshot.map((track) => ({
      id: track.id,
      fields: { track: asField(track.track), tracktotal: asField(track.trackTotal) },
    })),
  };
}
