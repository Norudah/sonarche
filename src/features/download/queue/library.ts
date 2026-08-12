import { albumPath } from "@/app/paths";
import type { DownloadJob } from "@/features/download/api";
import type { LibraryTrack } from "@/features/library/api";

/** Whether what a job produced still sits in the library. `null` means the
 * question does not apply yet (nothing imported). */
export type LibraryPresence = "full" | "partial" | "none";

/**
 * Whether what a finished job put in the library is still there: all of it,
 * part of it, or none. `null` while the job is running — mid-run items are
 * transient, and the question only settles once the job does — and on a job
 * that never imported anything (a failed download has nothing to be present).
 *
 * Every item id counts, whatever step its track stopped at: an id means beets
 * filed the file, and a job cancelled between import and enrich has put real
 * tracks in the library. Dropped duplicates are excluded — the enrich step
 * removed theirs on purpose, in favour of the item it kept.
 */
export function jobPresence(job: DownloadJob, isInLibrary: (itemId: number) => boolean): LibraryPresence | null {
  if (job.status !== "done" && job.status !== "failed" && job.status !== "cancelled") return null;
  const itemIds =
    job.kind === "album"
      ? job.tracks
          .filter((track) => track.itemId != null && track.duplicateOf == null)
          .map((track) => track.itemId as number)
      : job.report?.itemId != null
        ? [job.report.itemId]
        : [];
  if (itemIds.length === 0) return null;
  const present = itemIds.filter(isInLibrary).length;
  if (present === itemIds.length) return "full";
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
