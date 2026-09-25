import { createMemoryRouter, Navigate } from "react-router";

import { paths } from "@/app/paths";
import { AppLayout } from "@/app/layout/AppLayout";
import { DownloadPage } from "@/features/download/DownloadPage";
import { HistoryRoute } from "@/app/HistoryRoute";
import { ImportPage } from "@/features/import/ImportPage";
import { AlignSection } from "@/features/library/triage/AlignSection";
import { LibraryLayout } from "@/features/library/LibraryLayout";
import { AlbumDetailView } from "@/features/library/views/AlbumDetailView";
import { AlbumsView } from "@/features/library/views/AlbumsView";
import { ArtistDetailView } from "@/features/library/views/ArtistDetailView";
import { ArtistsView } from "@/features/library/views/ArtistsView";
import { CategoriesView } from "@/features/library/views/CategoriesView";
import { CategoryDetailView } from "@/features/library/views/CategoryDetailView";
import { GenreDetailView } from "@/features/library/views/GenreDetailView";
import { GenresView } from "@/features/library/views/GenresView";
import { MetadataPage } from "@/features/library/triage/MetadataPage";
import { PlaylistDetailView } from "@/features/library/views/PlaylistDetailView";
import { PlaylistsView } from "@/features/library/views/PlaylistsView";
import { TracksView } from "@/features/library/views/TracksView";

// Re-exported from the cycle-free `@/app/paths`.
export { albumPath, artistPath, categoryPath, genrePath, paths, playlistPath, triagePaths } from "@/app/paths";

// Dev only: `?route=` seeds the memory router's initial entry for deep links.
function devInitialEntries(): string[] | undefined {
  // Unit tests import this module without a `window`.
  if (!import.meta.env.DEV || typeof window === "undefined") return undefined;
  const route = new URLSearchParams(window.location.search).get("route");
  return route ? [route] : undefined;
}

export const router = createMemoryRouter(
  [
    {
      element: <AppLayout />,
      children: [
        { path: paths.download, element: <DownloadPage /> },
        {
          path: paths.import,
          // Composed here: alignment belongs to the library feature but follows an import.
          element: (
            <ImportPage>
              <AlignSection />
            </ImportPage>
          ),
        },
        { path: paths.history, element: <HistoryRoute /> },
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
            { path: paths.libraryArtist, element: <ArtistDetailView /> },
            { path: paths.libraryGenres, element: <GenresView /> },
            { path: paths.libraryGenre, element: <GenreDetailView /> },
            { path: paths.libraryCategories, element: <CategoriesView /> },
            { path: paths.libraryCategory, element: <CategoryDetailView /> },
            { path: paths.libraryPlaylists, element: <PlaylistsView /> },
            { path: paths.libraryPlaylist, element: <PlaylistDetailView /> },
          ],
        },
      ],
    },
  ],
  { initialEntries: devInitialEntries() },
);
