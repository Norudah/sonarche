/**
 * Route paths and the helpers that build them, kept in a dependency-free leaf
 * module — deliberately apart from `routes.tsx`.
 *
 * `routes.tsx` pulls in every page and layout, which pull the sidebar back in,
 * which needs these paths: a cycle. Anything that reads a path at module-eval
 * time (a nav table built at import, not inside a component) would hit `paths`
 * while `routes.tsx` is still initialising and throw "Cannot access 'paths'
 * before initialization". Living here, the paths finish evaluating before any
 * of that graph runs. `routes.tsx` re-exports these, so `@/app/routes` stays a
 * valid import site for everything that already used it.
 */

/**
 * Route ids stay technical (download / library); the visual identity
 * ("Explorer" / "Arche") is only i18n labels. Download is the default landing.
 */
export const paths = {
  download: "/",
  metadata: "/metadata",
  library: "/library",
  libraryTracks: "/library/tracks",
  libraryAlbums: "/library/albums",
  libraryAlbum: "/library/albums/:artist/:title",
  libraryArtists: "/library/artists",
  libraryArtist: "/library/artists/:name",
  libraryGenres: "/library/genres",
  libraryGenre: "/library/genres/:family",
  settings: "/settings",
  settingsApiKeys: "/settings/api-keys",
  settingsRateLimits: "/settings/rate-limits",
  settingsDeveloper: "/settings/developer",
} as const;

/**
 * Artist and title as two segments rather than one joined key: React Router
 * decodes path params, so anything we join here we would have to split back out
 * of an already-decoded string — which is impossible to do safely once a name
 * contains the separator. Two segments let the router do the encoding round-trip
 * for each half on its own.
 */
export function albumPath(artist: string, title: string): string {
  return `${paths.libraryAlbums}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
}

/** One segment, and it can stay one: an artist is a single name, so nothing has
 * to be split back apart on the way in. */
export function artistPath(name: string): string {
  return `${paths.libraryArtists}/${encodeURIComponent(name)}`;
}

/**
 * The family alone, or a specific genre inside it.
 *
 * The path segment carries the family *key*, not its label: the key is what the
 * sidecar computed and what survives a language change, while the two sentinels
 * have no name of their own to put in a URL.
 *
 * The genre rides in the query rather than as a second segment, for two reasons
 * that point the same way. Modelling: a genre is scoped inside its family, so
 * it refines that page rather than naming a different resource. And mechanics:
 * React Router expands an optional segment (`:family/:genre?`) into two
 * separate route entries, so flipping a chip unmounted the page and mounted a
 * fresh one — the hero restarted its backdrop fade and the shelf rebuilt every
 * card, which is exactly the jump this is meant to avoid. A query keeps one
 * match, so the page stays mounted and only the cards that differ move.
 *
 * It is still in the URL, so the selection survives leaving the page and coming
 * back — which component state did not.
 */
export function genrePath(family: string, genre?: string): string {
  const base = `${paths.libraryGenres}/${encodeURIComponent(family)}`;
  return genre == null ? base : `${base}?genre=${encodeURIComponent(genre)}`;
}
