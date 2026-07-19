import { useRef } from "react";
import { Outlet } from "react-router";

import { RouteTransition } from "@/app/layout/RouteTransition";
import { Sidebar } from "@/app/layout/Sidebar";
import { Topbar } from "@/app/layout/Topbar";
import { useScrollRestoration } from "@/app/layout/useScrollRestoration";
import { SetupGate } from "@/features/onboarding/SetupGate";
import { PlayerBar } from "@/shared/player/PlayerBar";

export function AppLayout() {
  // <main> is the app's scroll container, not the window — so scroll handling
  // is ours to do; nothing upstream resets or restores it.
  const scrollRef = useRef<HTMLElement>(null);
  useScrollRestoration(scrollRef);

  return (
    // The gate is outside the chrome on purpose: while the environment check is
    // in flight no route can render, so a live sidebar would only let the user
    // click nav items that appear to do nothing.
    <SetupGate>
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <div className="flex min-h-0 flex-1 flex-col">
            <Topbar />
            <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-background p-8">
              <RouteTransition>
                <Outlet />
              </RouteTransition>
            </main>
          </div>
        </div>
        <PlayerBar />
      </div>
    </SetupGate>
  );
}
