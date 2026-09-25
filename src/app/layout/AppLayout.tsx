import { useRef, useState } from "react";
import { Outlet } from "react-router";

import { JobProgressToasts } from "@/app/layout/JobProgressToasts";
import { RouteTransition } from "@/app/layout/RouteTransition";
import { HomeTourHost } from "@/app/tour/HomeTourHost";
import { SettingsHost } from "@/app/layout/SettingsHost";
import { Sidebar } from "@/app/layout/Sidebar";
import { Topbar } from "@/app/layout/Topbar";
import { useScrollRestoration } from "@/app/layout/useScrollRestoration";
import { InspectModeProvider } from "@/features/library/inspect/inspectMode";
import { LibraryRepair } from "@/features/library/LibraryRepair";
import { FavoriteCurrentButton } from "@/features/library/playlists/FavoriteButton";
import { SetupGate } from "@/features/onboarding/SetupGate";
import { readLaunchWelcome } from "@/features/settings/launchWelcome";
import { UpdatePrompt } from "@/features/update/UpdatePrompt";
import { HistoryDepthProvider } from "@/shared/navigation/historyDepth";
import { PlayerBar } from "@/shared/player/PlayerBar";
import { ToastViewport } from "@/shared/toast/ToastViewport";
import { ScrollportProvider } from "@/shared/ui/Scrollport";

export function AppLayout() {
  // <main> is the scroll container, not the window.
  const scrollRef = useRef<HTMLElement>(null);
  useScrollRestoration(scrollRef);

  // Read in the shell: the preference belongs to Settings, the gate to onboarding.
  const [welcome] = useState(readLaunchWelcome);

  return (
    // Outside the gate so the history depth counts from the session's first location.
    <HistoryDepthProvider>
      {/* Outside the chrome: no route can render until the environment check ends. */}
      <SetupGate welcome={welcome}>
        {/* Above the routes so the lens survives navigation. */}
        <InspectModeProvider>
          {/* Needs a healthy environment, which the gate opening guarantees. */}
          <LibraryRepair />
          <JobProgressToasts />
          {/* Inside the gate so it never covers onboarding. */}
          <UpdatePrompt />
          <HomeTourHost />
          <SettingsHost />
          <div className="flex h-full flex-col">
            <div className="flex min-h-0 flex-1">
              <Sidebar />
              {/* `min-w-0` lets wide children scroll instead of widening the column. */}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {/* Outside the scrollport so it doesn't scroll with the page. */}
                <Topbar />
                {/* No padding: `sticky top-0` resolves against the scrollport's padding
                    box. Pages pad themselves via PageContainer. */}
                <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-background">
                  <ScrollportProvider value={scrollRef}>
                    <RouteTransition>
                      <Outlet />
                    </RouteTransition>
                  </ScrollportProvider>
                </main>
              </div>
            </div>
            <PlayerBar accessory={<FavoriteCurrentButton />} />
            {/* Positioned against the player bar. */}
            <ToastViewport />
          </div>
        </InspectModeProvider>
      </SetupGate>
    </HistoryDepthProvider>
  );
}
