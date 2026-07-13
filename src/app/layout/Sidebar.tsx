import { cn } from "@heroui/react";
import { Disc, Download, Home, Layers, Library, Mic2, Music } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router";

import { paths } from "@/app/routes";

function NavItem({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "bg-accent/15 text-accent" : "text-muted hover:bg-default/40",
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </NavLink>
  );
}

export function Sidebar() {
  const { t } = useTranslation("common");
  const { t: tLibrary } = useTranslation("library");
  const { pathname } = useLocation();
  const inLibrary = pathname === paths.library || pathname.startsWith(`${paths.library}/`);

  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-separator bg-surface">
      <div className="flex flex-col gap-6 p-4">
        <div className="px-3 text-base font-semibold tracking-tight">♪ {t("appName")}</div>

        <nav className="flex flex-col gap-1">
          <NavItem to={paths.home} label={t("nav.home")} icon={Home} />
          <NavItem to={paths.download} label={t("nav.download")} icon={Download} end />
          <NavItem to={paths.library} label={t("nav.library")} icon={Library} />
        </nav>

        {inLibrary && (
          <>
            <div className="mx-3 border-t border-separator" />
            <nav className="flex flex-col gap-1">
              <NavItem to={paths.libraryTracks} label={tLibrary("views.tracks")} icon={Music} />
              <NavItem to={paths.libraryAlbums} label={tLibrary("views.albums")} icon={Disc} />
              <NavItem to={paths.libraryArtists} label={tLibrary("views.artists")} icon={Mic2} />
              <NavItem to={paths.libraryGenres} label={tLibrary("views.genres")} icon={Layers} />
            </nav>
          </>
        )}
      </div>
    </aside>
  );
}
