import { albumPath } from "@/app/paths";
import type { DownloadJob } from "@/features/download/api";
import type { LibraryTrack } from "@/features/library/api";

/** Whether what a job produced still sits in the library. `null` means the
 * question does not apply yet (nothing imported). */
export type LibraryPresence = "full" | "partial" | "none";

/** An album has no item of its own, so it reports on its tracks: all still
 * there, some pulled out, or the whole set gone. Dropped duplicates never had
 * an item and are excluded. */
export function albumPresence(job: DownloadJob, isInLibrary: (itemId: number) => boolean): LibraryPresence | null {
  const imported = job.tracks.filter(
    (track) => track.itemId != null && track.duplicateOf == null && track.status === "done",
  );
  if (imported.length === 0) return null;
  const present = imported.filter((track) => isInLibrary(track.itemId as number)).length;
  if (present === imported.length) return "full";
  return present === 0 ? "none" : "partial";
}

/**
 * Where a finished row leads in the library — the record it landed on, for a
 * playlist and a single alike, since there is no page for a lone track.
 *
 * `null` while nothing has been imported yet, or once what it produced has
 * been deleted: a link to a record that is no longer there is worse than no
 * link. The album is keyed by its album artist, falling back to the track
 * artist for a single that has none — the same rule the drawer uses.
 */
export function jobDestination(
  job: DownloadJob,
  libraryTrackFor: (itemId: number | null) => LibraryTrack | undefined,
): string | null {
  const itemIds = job.kind === "album" ? job.tracks.map((track) => track.itemId) : [job.report?.itemId ?? null];
  for (const itemId of itemIds) {
    const track = libraryTrackFor(itemId);
    if (track && track.album.trim() !== "") {
      return albumPath(track.albumArtist.trim() || track.artist.trim(), track.album);
    }
  }
  return null;
}
