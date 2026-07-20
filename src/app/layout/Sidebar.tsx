import { cn } from "@heroui/react";
import { AudioLines, Disc, Download, FileText, Layers, Mic2, Music, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

import { paths } from "@/app/routes";
import { layoutIds, springs } from "@/shared/motion/tokens";

function NavItem({ to, label, icon: Icon, end }: { to: string; label: string; icon: LucideIcon; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
          isActive ? "text-accent" : "text-muted hover:bg-default/40",
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* One pill for the whole nav: the shared layoutId makes Motion tween
              it from the previously active item instead of cross-fading two. */}
          {isActive && (
            <motion.span
              layoutId={layoutIds.navIndicator}
              transition={springs.snappy}
              className="absolute inset-0 rounded-md bg-accent/15"
            />
          )}
          <Icon className="relative size-4 shrink-0" />
          <span className="relative">{label}</span>
        </>
      )}
    </NavLink>
  );
}

function NavSection({ label, action, children }: { label: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2.5 pb-0.5">
        <p className="text-[11px] font-semibold tracking-widest text-muted uppercase">{label}</p>
        {action}
      </div>
      {children && <nav className="flex flex-col gap-0.5">{children}</nav>}
    </div>
  );
}

function AddPlaylistButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-default/40 hover:text-foreground"
    >
      <Plus className="size-3.5" />
    </button>
  );
}

function Divider() {
  return <div className="mx-2.5 border-t border-separator" />;
}

export function Sidebar() {
  const { t } = useTranslation("common");
  const { t: tLibrary } = useTranslation("library");

  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-separator bg-surface">
      <div className="flex flex-col gap-4 px-3 pt-7 pb-4">
        <div className="mb-5 flex items-center gap-2.5 px-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <AudioLines className="size-4.5" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">{t("appName")}</span>
        </div>

        <NavSection label={t("nav.sections.explorer")}>
          <NavItem to={paths.download} label={t("nav.download")} icon={Download} end />
          <NavItem to={paths.metadata} label={t("nav.metadata")} icon={FileText} />
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
