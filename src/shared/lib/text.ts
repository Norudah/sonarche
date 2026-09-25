/** Case- and accent-insensitive form, so "Beyonce" finds "Beyoncé". */
export function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
