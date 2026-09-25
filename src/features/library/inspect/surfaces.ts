import { matchPath } from "react-router";

import { paths } from "@/app/paths";
import { parseViewMode } from "@/features/library/viewMode";

/** Pages the lens can change: track-list bodies only. Albums and playlists
 * always; scoped pages only in their tracks mode. */
const ALWAYS = [paths.libraryTracks, paths.libraryAlbum, paths.libraryPlaylist];
const WHEN_SHOWING_TRACKS = [paths.libraryArtist, paths.libraryGenre, paths.libraryCategory];

export function isInspectable(pathname: string, params: URLSearchParams): boolean {
  if (ALWAYS.some((pattern) => matchPath(pattern, pathname) != null)) return true;
  if (parseViewMode(params) !== "tracks") return false;
  return WHEN_SHOWING_TRACKS.some((pattern) => matchPath(pattern, pathname) != null);
}
