import type { DownloadJob } from "@/features/download/api";

/** Whether what a job produced still sits in the library. `null` means the
 * question does not apply yet (nothing imported). */
export type LibraryPresence = "full" | "partial" | "none";

/** An album has no item of its own, so it reports on its tracks: all still
 * there, some pulled out, or the whole set gone. Dropped duplicates never had
 * an item and are excluded. */
export function albumPresence(
  job: DownloadJob,
  isInLibrary: (itemId: number) => boolean,
): LibraryPresence | null {
  const imported = job.tracks.filter(
    (track) => track.itemId != null && track.duplicateOf == null && track.status === "done",
  );
  if (imported.length === 0) return null;
  const present = imported.filter((track) => isInLibrary(track.itemId as number)).length;
  if (present === imported.length) return "full";
  return present === 0 ? "none" : "partial";
}
