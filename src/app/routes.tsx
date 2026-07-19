import { createMemoryRouter, Navigate } from "react-router";

import { AppLayout } from "@/app/layout/AppLayout";
import { DownloadPage } from "@/features/download/DownloadPage";
import { LibraryLayout } from "@/features/library/LibraryLayout";
import { AlbumDetailView } from "@/features/library/views/AlbumDetailView";
import { AlbumsView } from "@/features/library/views/AlbumsView";
import { ArtistsView } from "@/features/library/views/ArtistsView";
import { GenresView } from "@/features/library/views/GenresView";
import { TracksView } from "@/features/library/views/TracksView";
import { MetadataPage } from "@/features/metadata/MetadataPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

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
  libraryGenres: "/library/genres",
  settings: "/settings",
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

export const router = createMemoryRouter([
  // Standalone screen, deliberately outside the app shell (no sidebar/player).
  { path: paths.settings, element: <SettingsPage /> },
  {
    element: <AppLayout />,
    children: [
      { path: paths.download, element: <DownloadPage /> },
      { path: paths.metadata, element: <MetadataPage /> },
      {
        path: paths.library,
        element: <LibraryLayout />,
        children: [
          { index: true, element: <Navigate to={paths.libraryTracks} replace /> },
          { path: paths.libraryTracks, element: <TracksView /> },
          { path: paths.libraryAlbums, element: <AlbumsView /> },
          { path: paths.libraryAlbum, element: <AlbumDetailView /> },
          { path: paths.libraryArtists, element: <ArtistsView /> },
          { path: paths.libraryGenres, element: <GenresView /> },
        ],
      },
    ],
  },
]);
