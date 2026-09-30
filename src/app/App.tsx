import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";

import { router } from "@/app/routes";
import { ThemeProvider } from "@/features/settings/ThemeContext";
import { MotionProvider } from "@/shared/motion/MotionProvider";
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
      {/* Outermost: the theme also drives <html> and the native window frame. */}
      <ThemeProvider>
        <MotionProvider>
          <PlayerProvider>
            <RouterProvider router={router} />
          </PlayerProvider>
        </MotionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
