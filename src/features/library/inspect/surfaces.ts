import { matchPath } from "react-router";

import { paths } from "@/app/paths";
import { parseViewMode } from "@/features/library/viewMode";

/**
 * The surfaces the lens actually changes.
 *
 * Every one of them is a page whose body is a track list, which is what
 * inspection is currently able to redraw. The switch hides everywhere else — an
 * interface that offers a lever with nothing on the other end is how people stop
 * trusting the levers. The card shelves (albums, artists, genres) are what is
 * still missing: the lens has nothing to say about a wall of covers yet.
 *
 * An album and a playlist are always listed here: a tracklist is the whole point
 * of the page, so there is no other face for the lens to be wrong about.
 *
 * A scoped page counts only while it is showing its tracks: an artist on their
 * discography is a wall of covers, and the lens has nothing to say about covers
 * yet. It stays on underneath, so flipping that page to Morceaux lands straight
 * in the inspection table.
 */
const ALWAYS = [paths.libraryTracks, paths.libraryAlbum, paths.libraryPlaylist];
const WHEN_SHOWING_TRACKS = [paths.libraryArtist, paths.libraryGenre, paths.libraryCategory];

export function isInspectable(pathname: string, params: URLSearchParams): boolean {
  if (ALWAYS.some((pattern) => matchPath(pattern, pathname) != null)) return true;
  if (parseViewMode(params) !== "tracks") return false;
  return WHEN_SHOWING_TRACKS.some((pattern) => matchPath(pattern, pathname) != null);
}
