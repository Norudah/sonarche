import { cn } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router";

import { paths } from "@/app/routes";

function NavItem({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "bg-accent/15 text-accent" : "text-muted hover:bg-default/40",
        )
      }
    >
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
    <aside className="flex w-sidebar shrink-0 flex-col gap-6 border-r border-separator p-4">
      <div className="px-3 pt-2 text-base font-semibold tracking-tight">♪ {t("appName")}</div>

      <nav className="flex flex-col gap-1">
        <NavItem to={paths.home} label={t("nav.home")} />
        <NavItem to={paths.download} label={t("nav.download")} end />
        <NavItem to={paths.library} label={t("nav.library")} />
      </nav>

      {inLibrary && (
        <>
          <div className="mx-3 border-t border-separator" />
          <nav className="flex flex-col gap-1">
            <NavItem to={paths.libraryTracks} label={tLibrary("views.tracks")} />
            <NavItem to={paths.libraryAlbums} label={tLibrary("views.albums")} />
            <NavItem to={paths.libraryArtists} label={tLibrary("views.artists")} />
            <NavItem to={paths.libraryGenres} label={tLibrary("views.genres")} />
          </nav>
        </>
      )}
    </aside>
  );
}
