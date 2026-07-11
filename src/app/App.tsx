import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";

import { router } from "@/app/routes";
import { PlayerProvider } from "@/shared/player/PlayerContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PlayerProvider>
        <RouterProvider router={router} />
      </PlayerProvider>
    </QueryClientProvider>
  );
}
