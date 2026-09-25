/** Pure helpers turning a scan into what the confirmation says. */

import type { ScanReport } from "@/features/import/api";

/** Fallback SI units when no translated ones are given. */
const SI_UNITS = ["B", "kB", "MB", "GB", "TB"] as const;

/** Bytes in powers of 1000 with a decimal from GB up. Units are passed in
 * (translated: "Go" in French); `Intl` can't step between units itself. */
export function formatBytes(bytes: number, locale: string, units: readonly string[] = SI_UNITS): string {
  let value = Math.max(bytes, 0);
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }

  const digits = unit >= 3 && value < 100 ? 1 : 0;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

  return `${formatted} ${units[unit]}`;
}

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
