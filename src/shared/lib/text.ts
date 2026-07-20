/** Case- and accent-insensitive form, so "Beyonce" finds "Beyoncé". Shared by
 * every free-text search in the library (tracks, albums). */
export function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
