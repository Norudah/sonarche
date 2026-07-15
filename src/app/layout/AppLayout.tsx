import { Outlet } from "react-router";

import { Sidebar } from "@/app/layout/Sidebar";
import { Topbar } from "@/app/layout/Topbar";
import { SetupGate } from "@/features/onboarding/SetupGate";
import { PlayerBar } from "@/shared/player/PlayerBar";

export function AppLayout() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-h-0 flex-1 flex-col">
          <Topbar />
          <main className="min-h-0 flex-1 overflow-y-auto bg-background p-8">
            <SetupGate>
              <Outlet />
            </SetupGate>
          </main>
        </div>
      </div>
      <PlayerBar />
    </div>
  );
}
