import { albumPath } from "@/app/paths";
import type { AlbumTrackJob, DownloadJob, MetadataReport } from "@/features/download/api";
import type { LibraryTrack } from "@/features/library/api";

/** `duplicate`: nothing filed because the library already had the tracks. */
type LibraryPresence = "full" | "partial" | "none" | "duplicate";

/** Subset of the deck's `LibraryLookup`, kept here for the pure functions. */
export interface PresenceLookup {
  trackFor: (itemId: number | null) => LibraryTrack | undefined;
  has: (itemId: number) => boolean;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase();

/**
 * Whether the track an id resolves to is still the one the job filed: beets
 * recycles rowids. Title or album must match the report's stored tags (one is
 * enough, since destination changes and retitles each change only one).
 * Reports without stored tags pass.
 */
function isStillOurs(track: LibraryTrack | undefined, report: MetadataReport | null): boolean {
  if (!track) return false;
  if (!report?.title && !report?.album) return true;
  // A missing tag proves nothing: a recycled id must match on one it has.
  const titleMatches = !!report.title && normalize(track.title) === normalize(report.title);
  const albumMatches = !!report.album && normalize(track.album) === normalize(report.album);
  return titleMatches || albumMatches;
}

function filedItems(job: DownloadJob): { itemId: number; report: MetadataReport | null }[] {
  if (job.kind === "album") {
    return job.tracks
      .filter((track) => track.itemId != null && track.duplicateOf == null)
      .map((track) => ({ itemId: track.itemId as number, report: track.report }));
  }
  return job.report?.itemId != null ? [{ itemId: job.report.itemId, report: job.report }] : [];
}

/** The track an id the job filed still points at; undefined once gone or
 * recycled. Every read of a job's item ids goes through here, or a history
 * row shows (and acts on) whatever took over the id. */
export function filedTrack(
  itemId: number | null,
  report: MetadataReport | null,
  library: PresenceLookup,
): LibraryTrack | undefined {
  if (itemId == null) return undefined;
  const track = library.trackFor(itemId);
  return isStillOurs(track, report) ? track : undefined;
}

/** The job's own tracks still in the library, duplicates excluded. */
export function filedTracks(job: DownloadJob, library: PresenceLookup): LibraryTrack[] {
  return filedItems(job)
    .map(({ itemId, report }) => filedTrack(itemId, report, library))
    .filter((track): track is LibraryTrack => track != null);
}

/**
 * Whether a finished job's output is still in the library: all, part, or none.
 * `null` while running or when nothing was imported. Every item id counts,
 * except dropped duplicates; a job made only of duplicates gets `duplicate`.
 */
export function jobPresence(job: DownloadJob, library: PresenceLookup): LibraryPresence | null {
  if (job.status !== "done" && job.status !== "failed" && job.status !== "cancelled") return null;
  const items = filedItems(job);
  if (items.length === 0) {
    const kept = job.kind === "album" ? job.tracks.filter((track) => track.duplicateOf != null) : [];
    if (kept.length === 0) return null;
    // If the kept originals are gone too, report "none".
    return kept.some((track) => library.has(track.duplicateOf as number)) ? "duplicate" : "none";
  }
  const present = filedTracks(job, library).length;
  if (present === items.length) return "full";
  return present === 0 ? "none" : "partial";
}

/** The library album a finished row links to, or null when nothing (or no
 * longer anything) was filed. Same recycled-id check as `jobPresence`; keyed
 * by album artist, falling back to the track artist. */
export function jobDestination(job: DownloadJob, library: PresenceLookup): string | null {
  const filed = filedItems(job);
  const kept: { itemId: number; report: MetadataReport | null }[] =
    job.kind === "album"
      ? job.tracks
          .filter((track): track is AlbumTrackJob & { duplicateOf: number } => track.duplicateOf != null)
          .map((track) => ({ itemId: track.duplicateOf, report: null }))
      : [];
  for (const { itemId, report } of [...filed, ...kept]) {
    const track = filedTrack(itemId, report, library);
    if (track && track.album.trim() !== "") {
      return albumPath(track.albumArtist.trim() || track.artist.trim(), track.album);
    }
  }
  return null;
}
