import { findAlbum, type Album } from "@/features/library/albums/albums";
import { canonicalAlbumId } from "@/features/library/albums/move";
import type { LibraryTrack, MoveSpec, TrackUpdate } from "@/features/library/api";

/** Undo is the same move pointed back, recreating emptied records, plus a
 * metadata batch restoring the old positions. */

export interface MoveUndoPlan {
  /** One per source record. */
  specs: MoveSpec[];
  /** Restores the old track numbers and totals. */
  restore: TrackUpdate[];
}

function artistOf(track: LibraryTrack): string {
  return track.albumArtist.trim() || track.artist.trim();
}

function asField(value: number | null): string {
  return value == null ? "" : String(value);
}

/** Undo plan from the pre-move snapshot; null if a track had no record to return to. */
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
    // Target the surviving row, if any, so undo doesn't create a twin.
    const existing = findAlbum(currentAlbums, artist, title);
    const targetAlbumId = existing ? canonicalAlbumId(existing) : null;
    specs.push({
      itemIds: group.map((track) => track.id),
      ...(targetAlbumId != null ? { targetAlbumId } : { newAlbum: { album: title, albumartist: artist } }),
      // A recreated collection must come back as one.
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
