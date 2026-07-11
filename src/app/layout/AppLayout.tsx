import { cn } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router";

import { paths } from "@/app/routes";
import { SetupGate } from "@/features/onboarding/SetupGate";
import { PlayerBar } from "@/shared/player/PlayerBar";

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-accent/15 text-accent"
            : "text-muted-foreground hover:bg-default/40",
        )
      }
    >
      {label}
    </NavLink>
  );
}

export function AppLayout() {
  const { t } = useTranslation("common");
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-default/40 p-4">
          <div className="px-3 pt-2 text-base font-semibold tracking-tight">
            ♪ {t("appName")}
          </div>
          <nav className="flex flex-col gap-1">
            <NavItem to={paths.download} label={t("nav.download")} />
            <NavItem to={paths.library} label={t("nav.library")} />
          </nav>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto p-8">
          <SetupGate>
            <Outlet />
          </SetupGate>
        </main>
      </div>
      <PlayerBar />
    </div>
  );
}
