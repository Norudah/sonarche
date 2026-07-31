/**
 * Reading a move out loud: how much is about to travel, and how.
 *
 * Both answers are what the confirmation is for. "Move the library" is not a
 * decision anyone can weigh; "move 12 400 files, 68 GB, onto another disk" is.
 */

/** Decimal units, not binary: this number sits next to a disk's own capacity,
 * and disks are sold in decimal. 1 024-based sizes would read 7% smaller than
 * the figure in Finder for the same folder. */
export function formatBytes(bytes: number, locale: string): string {
  const units = ["o", "ko", "Mo", "Go", "To"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  // One decimal from a gigabyte up, none below: a tenth of a kilobyte is
  // noise, a tenth of a terabyte is 100 GB.
  const digits = unit >= 3 ? 1 : 0;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

/**
 * The last two segments of a path — enough to tell two destinations apart
 * without printing the twelve levels of a synced home folder.
 *
 * The full path is still shown where there is room for it; this is for the
 * places where there is not.
 */
export function shortenPath(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  if (parts.length <= 2) return path;
  return `…/${parts.slice(-2).join("/")}`;
}
