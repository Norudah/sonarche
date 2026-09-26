/** Pure helpers turning a scan into what the confirmation says. */

import type { ScanReport } from "@/features/import/api";

/** Undecodable extensions, most common first, ties alphabetical. Takes only
 * the field it reads, so archived imports can use it too. */
export function unplayableFormats(report: { unplayableByExtension: Record<string, number> }): string[] {
  return Object.entries(report.unplayableByExtension)
    .sort(([aExt, aCount], [bExt, bCount]) => bCount - aCount || aExt.localeCompare(bExt))
    .map(([extension]) => `.${extension}`);
}

/** A folder of photos scans fine but has nothing to import. */
export function hasAudio(report: ScanReport): boolean {
  return report.playable + report.unplayable > 0;
}

/** Shortens from the middle, keeping the volume and the folder name. */
export function shortenPath(path: string, maxSegments = 4): string {
  // Windows paths use backslashes.
  const separator = path.includes("\\") ? "\\" : "/";
  const segments = path.split(/[/\\]/).filter(Boolean);
  if (segments.length <= maxSegments) return path;

  const head = segments.slice(0, 1);
  const tail = segments.slice(-(maxSegments - 1));
  // Only POSIX paths start with a separator.
  const root = path.startsWith("/") ? "/" : "";
  return `${root}${head.join(separator)}${separator}…${separator}${tail.join(separator)}`;
}
