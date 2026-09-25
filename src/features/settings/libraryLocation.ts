/** Formatting helpers for the library move confirmation. */

/** Decimal units, like disk capacities and Finder. */
export function formatBytes(bytes: number, locale: string): string {
  const units = ["o", "ko", "Mo", "Go", "To"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  // One decimal from GB up.
  const digits = unit >= 3 ? 1 : 0;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

/** The last two path segments, where space is short. */
export function shortenPath(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  if (parts.length <= 2) return path;
  return `…/${parts.slice(-2).join("/")}`;
}
