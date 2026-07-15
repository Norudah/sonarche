import { cn } from "@heroui/react";
import { AudioLines, Disc, Download, FileText, Home, Layers, Mic2, Music, Plus, Tags } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

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

function NavSection({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-3">
        <p className="text-xs font-semibold tracking-widest text-muted uppercase">{label}</p>
        {action}
      </div>
      {children && <nav className="flex flex-col gap-1">{children}</nav>}
    </div>
  );
}

function AddPlaylistButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-default/40 hover:text-foreground"
    >
      <Plus className="size-3.5" />
    </button>
  );
}

function Divider() {
  return <div className="mx-3 border-t border-separator" />;
}

export function Sidebar() {
  const { t } = useTranslation("common");
  const { t: tLibrary } = useTranslation("library");

  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-separator bg-surface">
      <div className="flex flex-col gap-6 px-4 pt-8 pb-4">
        <div className="flex items-center gap-2.5 px-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <AudioLines className="size-5" />
          </div>
          <span className="text-base font-semibold tracking-tight">{t("appName")}</span>
        </div>

        <nav className="flex flex-col gap-1">
          <NavItem to={paths.home} label={t("nav.home")} icon={Home} end />
        </nav>

        <Divider />

        <NavSection label={t("nav.sections.explorer")}>
          <NavItem to={paths.download} label={t("nav.download")} icon={Download} end />
          <NavItem to={paths.metadata} label={t("nav.metadata")} icon={FileText} />
        </NavSection>

        <Divider />

        <NavSection label={t("nav.sections.browse")}>
          <NavItem to={paths.browseGenres} label={t("nav.browseGenres")} icon={Tags} />
        </NavSection>

        <Divider />

        <NavSection label={t("nav.sections.arche")}>
          <NavItem to={paths.libraryTracks} label={tLibrary("views.tracks")} icon={Music} />
          <NavItem to={paths.libraryAlbums} label={tLibrary("views.albums")} icon={Disc} />
          <NavItem to={paths.libraryArtists} label={tLibrary("views.artists")} icon={Mic2} />
          <NavItem to={paths.libraryGenres} label={tLibrary("views.genres")} icon={Layers} />
        </NavSection>

        <Divider />

        <NavSection label={t("nav.sections.playlists")} action={<AddPlaylistButton label={t("nav.addPlaylist")} />} />
      </div>
    </aside>
  );
}
