import { createMemoryRouter, Navigate } from "react-router";

import { AppLayout } from "@/app/layout/AppLayout";
import { DownloadPage } from "@/features/download/DownloadPage";
import { HomePage } from "@/features/home/HomePage";
import { LibraryLayout } from "@/features/library/LibraryLayout";
import { AlbumsView } from "@/features/library/views/AlbumsView";
import { ArtistsView } from "@/features/library/views/ArtistsView";
import { GenresView } from "@/features/library/views/GenresView";
import { TracksView } from "@/features/library/views/TracksView";

/**
 * Route ids stay technical (home / download / library); the visual identity
 * ("Explorer" / "Arche") is only i18n labels. Explorer is the default landing.
 */
export const paths = {
  home: "/home",
  download: "/",
  library: "/library",
  libraryTracks: "/library/tracks",
  libraryAlbums: "/library/albums",
  libraryArtists: "/library/artists",
  libraryGenres: "/library/genres",
} as const;

export const router = createMemoryRouter([
  {
    element: <AppLayout />,
    children: [
      { path: paths.home, element: <HomePage /> },
      { path: paths.download, element: <DownloadPage /> },
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
