import { createMemoryRouter, Navigate } from "react-router";

import { paths } from "@/app/paths";
import { AppLayout } from "@/app/layout/AppLayout";
import { DownloadPage } from "@/features/download/DownloadPage";
import { HistoryPage } from "@/features/download/HistoryPage";
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
import { TracksView } from "@/features/library/views/TracksView";
import { ApiKeysSection } from "@/features/settings/ApiKeysSection";
import { DeveloperSection } from "@/features/settings/DeveloperSection";
import { RateLimitsSection } from "@/features/settings/RateLimitsSection";
import { SettingsLayout } from "@/features/settings/SettingsLayout";

// Paths and their builders live in the leaf module `@/app/paths` to keep them
// out of this file's import cycle; re-exported so `@/app/routes` stays their
// public import site for the many callers that already use it.
export { albumPath, artistPath, categoryPath, genrePath, paths, triagePaths } from "@/app/paths";

// A memory router has no URL to deep-link, so in dev a `?route=` param seeds the
// initial entry — the only way to land a browser (or an automated one) straight
// on a nested view like an album. Stripped entirely from production builds.
function devInitialEntries(): string[] | undefined {
  // `typeof window` guard: this module is imported by node-env unit tests (via
  // `albumPath`), where there is no `window` to read.
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
        { path: paths.history, element: <HistoryPage /> },
        { path: paths.metadata, element: <MetadataPage /> },
        // Settings lives inside the shell like any other destination: same sidebar
        // (which switches to a category menu here), same player bar. Each category
        // is a route so the sidebar drives it through NavLink, active pill and all.
        {
          path: paths.settings,
          element: <SettingsLayout />,
          children: [
            { index: true, element: <Navigate to={paths.settingsApiKeys} replace /> },
            { path: paths.settingsApiKeys, element: <ApiKeysSection /> },
            { path: paths.settingsRateLimits, element: <RateLimitsSection /> },
            // Dev builds only; the backend command refuses to run in release anyway.
            ...(import.meta.env.DEV ? [{ path: paths.settingsDeveloper, element: <DeveloperSection /> }] : []),
          ],
        },
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
          ],
        },
      ],
    },
  ],
  { initialEntries: devInitialEntries() },
);
