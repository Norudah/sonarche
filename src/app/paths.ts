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
  import: "/import",
  history: "/history",
  metadata: "/metadata",
  library: "/library",
  libraryTracks: "/library/tracks",
  libraryAlbums: "/library/albums",
  libraryAlbum: "/library/albums/:artist/:title",
  libraryArtists: "/library/artists",
  libraryArtist: "/library/artists/:name",
  libraryGenres: "/library/genres",
  libraryGenre: "/library/genres/:family",
  libraryCategories: "/library/categories",
  libraryCategory: "/library/categories/:category",
  libraryPlaylists: "/library/playlists",
  libraryPlaylist: "/library/playlists/:id",
  settings: "/settings",
  settingsAppearance: "/settings/appearance",
  settingsMetadata: "/settings/metadata",
  settingsApiKeys: "/settings/api-keys",
  settingsRateLimits: "/settings/rate-limits",
  settingsLibrary: "/settings/library",
  settingsUpdates: "/settings/updates",
  settingsDeveloper: "/settings/developer",
} as const;

/**
 * Metadata-triage deep links — the contract between the Metadata page's
 * correction queue and the explorer views. Each
 * line of the queue navigates to one of these; the explorers parse the same
 * params back out (see the `triage` module beside each view, whose tests
 * round-trip against these strings so the two sides cannot drift).
 *
 * `?genre=` is the param the family page already carries a plain genre name
 * in, kept with the same meaning here; `missing` and `off-tree` are sentinel
 * values no real genre uses.
 */
export const triagePaths = {
  missingYear: `${paths.libraryTracks}?missing=year`,
  missingTrackNumber: `${paths.libraryTracks}?missing=track`,
  genreMissing: `${paths.libraryTracks}?genre=missing`,
  genreOffTree: `${paths.libraryTracks}?genre=off-tree`,
  missingArtwork: `${paths.libraryAlbums}?missing=artwork`,
  tracklistGaps: `${paths.libraryAlbums}?tracklist=gaps`,
  suspectMatch: `${paths.libraryTracks}?suspect=match`,
  duplicateRecording: `${paths.libraryTracks}?duplicates=recording`,
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

/**
 * A category, or one genre inside it — the same shape as `genrePath` for the
 * same reasons: the segment carries the stored (canonical English) value that
 * survives a language switch, and the genre refines the page through a query
 * param so flipping a chip never remounts it.
 */
export function categoryPath(category: string, genre?: string): string {
  const base = `${paths.libraryCategories}/${encodeURIComponent(category)}`;
  return genre == null ? base : `${base}?genre=${encodeURIComponent(genre)}`;
}

/** The store's numeric id, not the name: a playlist is freely renameable, and
 * a URL built on the name would die with every rename. */
export function playlistPath(id: number): string {
  return `${paths.libraryPlaylists}/${id}`;
}
