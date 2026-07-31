import { useRef, useState } from "react";
import { Outlet } from "react-router";

import { RouteTransition } from "@/app/layout/RouteTransition";
import { Sidebar } from "@/app/layout/Sidebar";
import { useScrollRestoration } from "@/app/layout/useScrollRestoration";
import { SetupGate } from "@/features/onboarding/SetupGate";
import { readLaunchWelcome } from "@/features/settings/launchWelcome";
import { useUpdatePrompt } from "@/features/update/useUpdatePrompt";
import { HistoryDepthProvider } from "@/shared/navigation/historyDepth";
import { PlayerBar } from "@/shared/player/PlayerBar";
import { ToastViewport } from "@/shared/toast/ToastViewport";
import { ScrollportProvider } from "@/shared/ui/Scrollport";

export function AppLayout() {
  // <main> is the app's scroll container, not the window — so scroll handling
  // is ours to do; nothing upstream resets or restores it.
  const scrollRef = useRef<HTMLElement>(null);
  useScrollRestoration(scrollRef);
  // Inside the shell, so the prompt has the toast viewport below it to land in.
  useUpdatePrompt();

  // Read here rather than in the gate, because `features` do not import each
  // other and this preference belongs to Settings; the shell is the one place
  // allowed to know about both. Once, at mount: it decides what the launch
  // looks like, and the launch is over before anyone can reach the switch that
  // changes it.
  const [welcome] = useState(readLaunchWelcome);

  return (
    // The provider wraps everything and lives outside the gate: the count has to
    // start at the session's first location and survive every page, and one
    // mounted per route would reset to zero on the very navigation it exists to
    // remember.
    <HistoryDepthProvider>
      {/* The gate is inside it but outside the chrome on purpose: while the
          environment check is in flight no route can render, so a live sidebar
          would only let the user click nav items that appear to do nothing. */}
      <SetupGate welcome={welcome}>
        <div className="flex h-full flex-col">
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            {/* `min-w-0` so a page with a wide, horizontally scrollable child (the
                download queue's table) scrolls that child instead of forcing the
                whole content column — and the viewport — wider than the window. */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {/* No padding here: this is the scrollport, and `sticky top-0`
                  resolves against its padding box. Padding on the scrollport
                  would offset every sticky child by 2rem and let content scroll
                  visibly through the gap above it. Pages own their padding via
                  PageContainer, which keeps the scrollport edge available. */}
              <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-background">
                <ScrollportProvider value={scrollRef}>
                  <RouteTransition>
                    <Outlet />
                  </RouteTransition>
                </ScrollportProvider>
              </main>
            </div>
          </div>
          <PlayerBar />
          {/* Mounted beside the player bar, not above it in the tree: the
              viewport is positioned against the bar, and the two only ever
              appear together — the onboarding walkthrough replaces this whole
              chrome and speaks for itself. */}
          <ToastViewport />
        </div>
      </SetupGate>
    </HistoryDepthProvider>
  );
}
