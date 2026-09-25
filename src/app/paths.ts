/**
 * Route paths and builders, in a dependency-free module: `routes.tsx` imports
 * every page, which import these paths back, and module-eval reads would hit
 * the cycle. `routes.tsx` re-exports them.
 */

/** Technical route ids; "Explorer" / "Arche" are only i18n labels. */
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
} as const;

/** `?vue=inspection` opens the arriving page in inspection mode; consumed on
 * arrival (the mode itself lives in `inspectMode`). */
export const INSPECT_PARAM = "vue";
export const INSPECT_VALUE = "inspection";

// Track views only: the albums shelf has no inspection mode.
const LENS = `${INSPECT_PARAM}=${INSPECT_VALUE}`;

/** Metadata-triage deep links, parsed back by each view's `triage` module (tests round-trip them). */
export const triagePaths = {
  missingYear: `${paths.libraryTracks}?missing=year&${LENS}`,
  missingTrackNumber: `${paths.libraryTracks}?missing=track&${LENS}`,
  genreMissing: `${paths.libraryTracks}?genre=missing&${LENS}`,
  genreOffTree: `${paths.libraryTracks}?genre=off-tree&${LENS}`,
  missingArtwork: `${paths.libraryAlbums}?missing=artwork`,
  tracklistGaps: `${paths.libraryAlbums}?tracklist=gaps`,
  suspectMatch: `${paths.libraryTracks}?suspect=match&${LENS}`,
  duplicateRecording: `${paths.libraryTracks}?duplicates=recording&${LENS}`,
  artistImageMissing: `${paths.libraryArtists}?missing=image`,
} as const;

/** Two segments, not a joined key: router params arrive decoded, so a joined
 * name couldn't be split safely. */
export function albumPath(artist: string, title: string): string {
  return `${paths.libraryAlbums}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
}

export function artistPath(name: string): string {
  return `${paths.libraryArtists}/${encodeURIComponent(name)}`;
}

/**
 * The family segment carries the key (language-independent). The genre goes
 * in the query: an optional segment makes React Router remount the page.
 */
export function genrePath(family: string, genre?: string): string {
  const base = `${paths.libraryGenres}/${encodeURIComponent(family)}`;
  return genre == null ? base : `${base}?genre=${encodeURIComponent(genre)}`;
}

/** Same shape as `genrePath`: the stored English value, genre in the query. */
export function categoryPath(category: string, genre?: string): string {
  const base = `${paths.libraryCategories}/${encodeURIComponent(category)}`;
  return genre == null ? base : `${base}?genre=${encodeURIComponent(genre)}`;
}

/** By id: playlists can be renamed. */
export function playlistPath(id: number): string {
  return `${paths.libraryPlaylists}/${id}`;
}
