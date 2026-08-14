import { albumPath } from "@/app/paths";
import type { AlbumTrackJob, DownloadJob, MetadataReport } from "@/features/download/api";
import type { LibraryTrack } from "@/features/library/api";

/** Whether what a job produced still sits in the library. `null` means the
 * question does not apply yet (nothing imported). `duplicate` is the job that
 * filed nothing because the library already held its tracks — the one row
 * that used to show no label at all and read as unresolved forever. */
export type LibraryPresence = "full" | "partial" | "none" | "duplicate";

/** The lookups presence needs. A subset of the deck's `LibraryLookup`, named
 * here so the pure functions do not depend on a component file. */
export interface PresenceLookup {
  trackFor: (itemId: number | null) => LibraryTrack | undefined;
  has: (itemId: number) => boolean;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase();

/**
 * Whether the library track an id resolves to is still the track the job
 * filed. beets' item ids are plain SQLite rowids and get recycled: delete the
 * most recent album, download another, and an old history row's id can point
 * at unrelated audio — which would quietly flip the row back to "in the
 * library" and link its title to a stranger's record.
 *
 * The report's stored tags are the anchor. Requiring only one of title/album
 * to match keeps the check honest without making it brittle: a destination
 * change rewrites the album but not the title, a user retitling one track
 * leaves its album alone. Reports written before the tags existed (or jobs
 * with no report at all) pass — no anchor, no verdict.
 */
function isStillOurs(track: LibraryTrack | undefined, report: MetadataReport | null): boolean {
  if (!track) return false;
  if (!report?.title && !report?.album) return true;
  const titleMatches = !report.title || normalize(track.title) === normalize(report.title);
  const albumMatches = !report.album || normalize(track.album) === normalize(report.album);
  return titleMatches || albumMatches;
}

/** The item ids a job filed, paired with the report that anchors each one. */
function filedItems(job: DownloadJob): { itemId: number; report: MetadataReport | null }[] {
  if (job.kind === "album") {
    return job.tracks
      .filter((track) => track.itemId != null && track.duplicateOf == null)
      .map((track) => ({ itemId: track.itemId as number, report: track.report }));
  }
  return job.report?.itemId != null ? [{ itemId: job.report.itemId, report: job.report }] : [];
}

function presentCount(items: { itemId: number; report: MetadataReport | null }[], library: PresenceLookup): number {
  return items.filter(({ itemId, report }) => library.has(itemId) && isStillOurs(library.trackFor(itemId), report))
    .length;
}

/**
 * Whether what a finished job put in the library is still there: all of it,
 * part of it, or none. `null` while the job is running — mid-run items are
 * transient, and the question only settles once the job does — and on a job
 * that never imported anything (a failed download has nothing to be present).
 *
 * Every item id counts, whatever step its track stopped at: an id means beets
 * filed the file, and a job cancelled between import and enrich has put real
 * tracks in the library. Dropped duplicates are excluded from the count — the
 * enrich step removed theirs on purpose, in favour of the item it kept — but
 * a job *made entirely of them* gets its own answer: the library already had
 * these tracks, which is a verdict, not an eternal "awaiting".
 */
export function jobPresence(job: DownloadJob, library: PresenceLookup): LibraryPresence | null {
  if (job.status !== "done" && job.status !== "failed" && job.status !== "cancelled") return null;
  const items = filedItems(job);
  if (items.length === 0) {
    const kept = job.kind === "album" ? job.tracks.filter((track) => track.duplicateOf != null) : [];
    if (kept.length === 0) return null;
    // The row filed nothing because the library already held it. If the kept
    // originals are gone too, the honest answer is "removed" — pointing at
    // "already in the library" would claim music that is no longer there.
    return kept.some((track) => library.has(track.duplicateOf as number)) ? "duplicate" : "none";
  }
  const present = presentCount(items, library);
  if (present === items.length) return "full";
  return present === 0 ? "none" : "partial";
}

/**
 * Where a finished row leads in the library — the record it landed on, for a
 * playlist and a single alike, since there is no page for a lone track.
 *
 * `null` while nothing has been imported yet, or once what it produced has
 * been deleted: a link to a record that is no longer there is worse than no
 * link — and a link to whatever unrelated track inherited a recycled id is
 * worse still, hence the same anchor check as the presence. A row resolved as
 * a duplicate links to the record the enrich step kept. The album is keyed by
 * its album artist, falling back to the track artist for a single that has
 * none — the same rule the drawer uses.
 */
export function jobDestination(job: DownloadJob, library: PresenceLookup): string | null {
  const filed = filedItems(job);
  const kept: { itemId: number; report: MetadataReport | null }[] =
    job.kind === "album"
      ? job.tracks
          .filter((track): track is AlbumTrackJob & { duplicateOf: number } => track.duplicateOf != null)
          .map((track) => ({ itemId: track.duplicateOf, report: null }))
      : [];
  for (const { itemId, report } of [...filed, ...kept]) {
    const track = library.trackFor(itemId);
    if (track && isStillOurs(track, report) && track.album.trim() !== "") {
      return albumPath(track.albumArtist.trim() || track.artist.trim(), track.album);
    }
  }
  return null;
}
