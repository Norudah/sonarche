import { cn } from "@heroui/react";
import type { LucideIcon } from "lucide-react";
import {
  Disc,
  Download,
  FileText,
  FolderInput,
  History,
  Layers,
  LayoutGrid,
  Mic2,
  Music,
  Plus,
  Tags,
} from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router";

import { paths, playlistPath } from "@/app/routes";
import { useCreatePlaylist, usePlaylists } from "@/features/library/playlists/hooks";
import { PlaylistMarkerGlyph } from "@/features/library/playlists/PlaylistGlyph";
import { PlaylistNameDialog } from "@/features/library/playlists/PlaylistNameDialog";
import { sidebarPlaylists } from "@/features/library/playlists/playlists";
import { useTriageCount } from "@/features/library/triage/useTriageCount";
import { useNotificationBadges } from "@/shared/lib/notificationBadges";
import { isMacOS } from "@/shared/lib/platform";
import { layoutIds, springs } from "@/shared/motion/tokens";
import { SonarcheMark } from "@/shared/ui/SonarcheMark";

function NavItem({
  to,
  label,
  icon: Icon,
  glyph,
  end,
  badge = 0,
}: {
  to: string;
  label: string;
  icon?: LucideIcon;
  /** Replaces the icon (e.g. a playlist thumbnail or colour). */
  glyph?: ReactNode;
  end?: boolean;
  /** Hidden at zero. */
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
          isActive ? "text-accent" : "text-muted hover:bg-default/40",
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Shared layoutId: Motion slides the pill between items. */}
          {isActive && (
            <motion.span
              layoutId={layoutIds.navIndicator}
              transition={springs.snappy}
              className="absolute inset-0 rounded-lg bg-accent/15"
            />
          )}
          {glyph ? (
            <span className="relative flex size-4 shrink-0 items-center justify-center">{glyph}</span>
          ) : (
            Icon && <Icon className="relative size-4 shrink-0" />
          )}
          <span className="relative min-w-0 truncate">{label}</span>
          {/* Amber like the triage counts; accent would vanish in the active pill. */}
          {badge > 0 && (
            <span className="relative ml-auto rounded-full bg-warning-soft px-1.5 py-px text-[0.6875rem] font-semibold text-warning tabular-nums">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function NavSection({
  label,
  action,
  tourId,
  children,
}: {
  label: string;
  action?: ReactNode;
  /** Guided tour anchor, see `app/tour`. */
  tourId?: string;
  children: ReactNode;
}) {
  return (
    <div data-tour={tourId} className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between pr-2 pl-3">
        <p className="text-[10px] font-semibold tracking-widest text-muted/70 uppercase">{label}</p>
        {action}
      </div>
      <nav className="flex flex-col gap-1">{children}</nav>
    </div>
  );
}

/** Closer to the section it opens, so the label groups with its items. */
function Divider() {
  return <div className="mx-3 mt-6 mb-4 border-t border-separator" />;
}

function MainNav() {
  const { t } = useTranslation("common");
  const { t: tLibrary } = useTranslation("library");
  // Also warms the library cache from app start.
  const toFix = useTriageCount();
  const badges = useNotificationBadges();

  return (
    <div className="flex flex-col">
      <NavSection label={t("nav.sections.explorer")} tourId="explorer">
        <NavItem to={paths.download} label={t("nav.download")} icon={Download} end />
        <NavItem to={paths.import} label={t("nav.import")} icon={FolderInput} />
        <NavItem to={paths.history} label={t("nav.history")} icon={History} />
        <NavItem to={paths.metadata} label={t("nav.metadata")} icon={FileText} badge={badges ? toFix : 0} />
      </NavSection>

      <Divider />

      <NavSection label={t("nav.sections.arche")} tourId="arche">
        <NavItem to={paths.libraryTracks} label={tLibrary("views.tracks")} icon={Music} />
        <NavItem to={paths.libraryAlbums} label={tLibrary("views.albums")} icon={Disc} />
        <NavItem to={paths.libraryArtists} label={tLibrary("views.artists")} icon={Mic2} />
        <NavItem to={paths.libraryGenres} label={tLibrary("views.genres")} icon={Layers} />
        <NavItem to={paths.libraryCategories} label={tLibrary("views.categories")} icon={Tags} />
      </NavSection>

      <Divider />

      <PlaylistsNav />
    </div>
  );
}

/**
 * Playlist navigation, capped to the most recently touched lists (see
 * `sidebarPlaylists`); the shelf entry holds them all.
 */
function PlaylistsNav() {
  const { t: tLibrary } = useTranslation("library");
  const navigate = useNavigate();
  const playlists = usePlaylists();
  const create = useCreatePlaylist();
  const [creating, setCreating] = useState(false);

  const all = playlists.data ?? [];
  const shown = sidebarPlaylists(all);

  return (
    <NavSection
      label={tLibrary("views.playlists")}
      tourId="playlists"
      action={
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label={tLibrary("playlists.create")}
          title={tLibrary("playlists.create")}
          className="flex size-5 cursor-pointer items-center justify-center rounded text-muted/70 outline-none transition-colors hover:bg-default/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Plus className="size-3.5" />
        </button>
      }
    >
      <NavItem to={paths.libraryPlaylists} label={tLibrary("playlists.all")} icon={LayoutGrid} end />

      {shown.map((playlist) => (
        <NavItem
          key={playlist.id}
          to={playlistPath(playlist.id)}
          label={playlist.kind === "favorites" ? tLibrary("playlists.favorites") : playlist.name}
          glyph={<PlaylistMarkerGlyph playlist={playlist} className="size-4" />}
        />
      ))}

      <PlaylistNameDialog
        isOpen={creating}
        onClose={() => setCreating(false)}
        title={tLibrary("playlists.create")}
        confirmLabel={tLibrary("playlists.createConfirm")}
        existing={all}
        reservedNames={[tLibrary("playlists.favorites")]}
        isPending={create.isPending}
        onSubmit={(name) =>
          create.mutate(name, {
            onSuccess: (created) => {
              setCreating(false);
              // Its empty state explains how to fill it.
              navigate(playlistPath(created.id));
            },
          })
        }
      />
    </NavSection>
  );
}

export function Sidebar() {
  const { t } = useTranslation("common");

  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-separator bg-surface">
      {/* macOS has no title bar: this strip is the window's drag handle and
          clears the traffic lights (positioned in tauri.conf.json). Contents are
          `pointer-events-none` so presses reach the drag region. */}
      <div data-tauri-drag-region className={cn("flex items-center gap-3 px-6 pb-7", isMacOS ? "pt-14" : "pt-7")}>
        <SonarcheMark className="pointer-events-none size-9 shrink-0" />
        <span className="pointer-events-none text-base font-semibold tracking-tight">{t("appName")}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        <MainNav />
      </div>

      <div className="pb-2" />
    </aside>
  );
}
