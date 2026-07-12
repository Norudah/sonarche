import { Outlet } from "react-router";

/**
 * Arche shell. The contextual view switcher (tracks/albums/artists/genres)
 * lives in the app sidebar; this layout hosts library-wide chrome later.
 */
export function LibraryLayout() {
  return <Outlet />;
}
