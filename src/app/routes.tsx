import { createMemoryRouter, Navigate } from "react-router";

import { AppLayout } from "@/app/layout/AppLayout";
import { DownloadPage } from "@/features/download/DownloadPage";
import { LibraryLayout } from "@/features/library/LibraryLayout";
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
  libraryArtists: "/library/artists",
  libraryGenres: "/library/genres",
  settings: "/settings",
} as const;

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
          { path: paths.libraryArtists, element: <ArtistsView /> },
          { path: paths.libraryGenres, element: <GenresView /> },
        ],
      },
    ],
  },
]);
