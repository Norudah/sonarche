/**
 * Turning a scan into the few things the confirmation screen says.
 *
 * Pure and apart from the page, because the interesting part is not the layout
 * — it is deciding what a number means. A folder with 12 000 tracks and one
 * with 3 need the same sentence to be true of both.
 */

import type { ScanReport } from "@/features/import/api";

/** The fallback ladder, in SI symbols. Used when no translated one is given. */
const SI_UNITS = ["B", "kB", "MB", "GB", "TB"] as const;

/**
 * Bytes as the OS would say it: powers of 1000, one decimal past a gigabyte.
 *
 * `Intl.NumberFormat` with `unit: "byte"` exists but only reaches "byte" and
 * "kilobyte" spelled out, and it never switches unit on its own — so the
 * stepping is ours while the number formatting is not.
 *
 * The unit names are handed in rather than held here: they are translated (a
 * French gigabyte is "Go", and macOS says so), and a util that reached for the
 * i18n instance would stop being a pure function over its arguments.
 */
export function formatBytes(bytes: number, locale: string, units: readonly string[] = SI_UNITS): string {
  let value = Math.max(bytes, 0);
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }

  // A tenth of a gigabyte is a meaningful difference; a tenth of a kilobyte is
  // noise. The decimal appears only where it earns its place.
  const digits = unit >= 3 && value < 100 ? 1 : 0;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

  return `${formatted} ${units[unit]}`;
}

/** Extensions of what cannot be decoded, most common first, dotted for reading.
 * Ties broken alphabetically so the same folder always reads the same. */
export function unplayableFormats(report: ScanReport): string[] {
  return Object.entries(report.unplayableByExtension)
    .sort(([aExt, aCount], [bExt, bCount]) => bCount - aCount || aExt.localeCompare(bExt))
    .map(([extension]) => `.${extension}`);
}

/** Whether there is anything to import at all. A folder of photographs scans
 * cleanly and would otherwise offer a button that does nothing. */
export function hasAudio(report: ScanReport): boolean {
  return report.playable + report.unplayable > 0;
}

/**
 * The path, shortened from the middle when it is too long for one line.
 *
 * Both ends carry meaning — the volume it lives on and the folder's own name —
 * and it is the middle, the six levels of nesting, that nobody reads. Cutting
 * the front (the usual ellipsis) throws away the half that says *where*.
 */
export function shortenPath(path: string, maxSegments = 4): string {
  // Both separators. The folder picker hands back the path exactly as the OS
  // spells it, so on Windows this is `C:\Users\…` — split on "/" alone it was
  // one segment, always under the ceiling, and nothing was ever shortened.
  const separator = path.includes("\\") ? "\\" : "/";
  const segments = path.split(/[/\\]/).filter(Boolean);
  if (segments.length <= maxSegments) return path;

  const head = segments.slice(0, 1);
  const tail = segments.slice(-(maxSegments - 1));
  // The leading separator belongs to a POSIX path only: `C:\…` is already
  // absolute, and a backslash in front of it names something else entirely.
  const root = path.startsWith("/") ? "/" : "";
  return `${root}${head.join(separator)}${separator}…${separator}${tail.join(separator)}`;
}
