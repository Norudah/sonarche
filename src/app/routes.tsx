import { createMemoryRouter } from "react-router";

import { AppLayout } from "@/app/layout/AppLayout";
import { DownloadPage } from "@/features/download/DownloadPage";
import { LibraryPage } from "@/features/library/LibraryPage";

export const paths = {
  download: "/",
  library: "/library",
} as const;

export const router = createMemoryRouter([
  {
    element: <AppLayout />,
    children: [
      { path: paths.download, element: <DownloadPage /> },
      { path: paths.library, element: <LibraryPage /> },
    ],
  },
]);
