export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

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
