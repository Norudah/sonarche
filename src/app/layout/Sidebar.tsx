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
import { NavLink, useLocation, useNavigate } from "react-router";

import { paths, playlistPath } from "@/app/routes";
import { useCreatePlaylist, usePlaylists } from "@/features/library/playlists/hooks";
import { PlaylistMarkerGlyph } from "@/features/library/playlists/PlaylistGlyph";
import { PlaylistNameDialog } from "@/features/library/playlists/PlaylistNameDialog";
import { sidebarPlaylists } from "@/features/library/playlists/playlists";
import { useTriageCount } from "@/features/library/triage/useTriageCount";
import { settingsCategories } from "@/features/settings/categories";
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
  indicatorId = layoutIds.navIndicator,
}: {
  to: string;
  label: string;
  icon?: LucideIcon;
  /** Takes the icon's place when the entry has a face of its own — a playlist
   * wearing its thumbnail or its colour. */
  glyph?: ReactNode;
  end?: boolean;
  /** A count worth a glance (things to fix behind this entry). Zero hides it. */
  badge?: number;
  indicatorId?: string;
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
          {/* One pill for the whole nav: the shared layoutId makes Motion tween
              it from the previously active item instead of cross-fading two. */}
          {isActive && (
            <motion.span
              layoutId={indicatorId}
              transition={springs.snappy}
              className="absolute inset-0 rounded-lg bg-accent/15"
            />
          )}
          {/* The wrapper carries the stacking and the 16px box, so a glyph only
              has to fill it — an <img> and an <svg> would otherwise need two
              different sets of classes at the call site. */}
          {glyph ? (
            <span className="relative flex size-4 shrink-0 items-center justify-center">{glyph}</span>
          ) : (
            Icon && <Icon className="relative size-4 shrink-0" />
          )}
          {/* min-w-0 + truncate: playlist names are user text and must clip
              rather than bend the sidebar's column. */}
          <span className="relative min-w-0 truncate">{label}</span>
          {/* Amber, like the triage counts it echoes — accent would dissolve
              into the active pill. Capped so a neglected library cannot bend
              the sidebar's column. */}
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

function NavSection({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* A shade lighter and a hair smaller than the items they head: these are
          signposts, and they should be found when looked for rather than read
          on the way past. The optional action keeps to the same register — a
          control found when looked for, not a button competing with the items. */}
      <div className="flex items-center justify-between pr-2 pl-3">
        <p className="text-[10px] font-semibold tracking-widest text-muted/70 uppercase">{label}</p>
        {action}
      </div>
      <nav className="flex flex-col gap-1">{children}</nav>
    </div>
  );
}

/**
 * Asymmetric on purpose: a rule sits closer to the section it opens than to the
 * one it closes, so the eye groups the label with its items instead of reading
 * the divider as floating between two equal blocks.
 */
function Divider() {
  return <div className="mx-3 mt-6 mb-4 border-t border-separator" />;
}

/** The everyday navigation: Explorer + Arche. */
function MainNav() {
  const { t } = useTranslation("common");
  const { t: tLibrary } = useTranslation("library");
  // Subscribing here also warms the library cache from app start, so the
  // explorers open on data the sidebar already paid for.
  const toFix = useTriageCount();
  const badges = useNotificationBadges();

  return (
    <div className="flex flex-col">
      <NavSection label={t("nav.sections.explorer")}>
        <NavItem to={paths.download} label={t("nav.download")} icon={Download} end />
        {/* Directly under Downloads: the two ways music enters the ark, in the
            order most people meet them. */}
        <NavItem to={paths.import} label={t("nav.import")} icon={FolderInput} />
        <NavItem to={paths.history} label={t("nav.history")} icon={History} />
        <NavItem to={paths.metadata} label={t("nav.metadata")} icon={FileText} badge={badges ? toFix : 0} />
      </NavSection>

      <Divider />

      <NavSection label={t("nav.sections.arche")}>
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
 * Its own section, not a shelf of the Arche: the shelves above catalogue what
 * the library *is*, while a playlist is something the user made out of it —
 * and each one is a destination, so each one gets a nav entry of its own.
 *
 * The "+" lives in the section header rather than as a pseudo-item in the
 * list: an item that creates instead of navigating would be a button dressed
 * as a destination, and it would sink below the fold as the list grows.
 *
 * Bounded on purpose. A user with forty playlists would otherwise turn this
 * column into a scrolling directory, and navigation that has to be searched is
 * no longer navigation: the sidebar names the eight lists you last touched
 * (see `sidebarPlaylists`) and the shelf heading them holds every one of them.
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
      {/* The shelf first, above the lists it holds — not below them as an
          afterthought. It is where a playlist is found when its name is not on
          screen, and a door at the bottom of a growing column is a door that
          moves. No tally: the number of playlists is not a thing to keep in
          your head, and the shelf is one click away from the exact answer.
          Then favorites, always second — the app's own list, ahead of the
          user's, in the seat it never leaves. */}
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
              // Straight into the new, empty list: its empty state says how to
              // fill it, which is the next thing the user will want to know.
              navigate(playlistPath(created.id));
            },
          })
        }
      />
    </NavSection>
  );
}

/** The settings menu that takes the main nav's place. Headed by a "Paramètres"
 * signpost in the same style/position as "Explorer" — the only thing telling the
 * user the sidebar has switched context. Categories keep their own active pill so
 * it never inherits the main nav's. */
function SettingsNav() {
  const { t } = useTranslation("settings");

  return (
    <NavSection label={t("title")}>
      {settingsCategories.map(({ path, labelKey, icon }) => (
        <NavItem key={path} to={path} label={t(labelKey)} icon={icon} indicatorId={layoutIds.settingsNavIndicator} />
      ))}
    </NavSection>
  );
}

export function Sidebar() {
  const { t } = useTranslation("common");
  const { pathname } = useLocation();

  const inSettings = pathname.startsWith(paths.settings);

  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-separator bg-surface">
      {/* On macOS the window has no native title bar, so this strip is what the
          user grabs to move it — and, being top-left, it is also where the
          traffic lights are painted over our webview. Their own distance from
          the window corner is `trafficLightPosition` in tauri.conf.json, not
          this padding — that was the wrong lever the first time round. `pt-14`
          is just their vertical clearance, so the logo sits comfortably below
          them rather than crowding the same row.

          Everywhere else there is nothing to clear: `titleBarStyle` is a macOS
          key, so Windows keeps its own title bar above us and the clearance
          would be dead space under it. The drag region stays either way — a
          second place to grab the window costs nothing.

          `pointer-events-none` on the contents because a drag region only
          reacts to presses that land on the element carrying the attribute,
          and a press on the logo or the wordmark would otherwise do nothing. */}
      <div data-tauri-drag-region className={cn("flex items-center gap-3 px-6 pb-7", isMacOS ? "pt-14" : "pt-7")}>
        {/* No tile behind it: the mark is a coloured illustration, not a glyph,
            so an accent plate would fight its own indigo instead of carrying it. */}
        <SonarcheMark className="pointer-events-none size-9 shrink-0" />
        <span className="pointer-events-none text-base font-semibold tracking-tight">{t("appName")}</span>
      </div>

      {/* Both nav bodies stay mounted and only their opacity crosses over — a
          plain CSS transition, so it always settles cleanly at 0/1 with no
          mount/unmount gap and nothing to stutter. The hidden layer drops
          pointer events so its links aren't clickable through the fade. `flex-1`
          floors the bottom entry in either mode. */}
      <div className="relative flex-1">
        <div
          className={cn(
            // Scrolls: the playlists section grows with the user's lists, and
            // the column must clip and scroll rather than push Settings out.
            "absolute inset-0 overflow-y-auto px-3 pb-2 transition-opacity duration-200 ease-out",
            inSettings ? "pointer-events-none opacity-0" : "opacity-100",
          )}
          aria-hidden={inSettings}
        >
          <MainNav />
        </div>
        <div
          className={cn(
            "absolute inset-0 px-3 transition-opacity duration-200 ease-out",
            inSettings ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-hidden={!inSettings}
        >
          <SettingsNav />
        </div>
      </div>

      {/* No bottom entry any more: the way into settings, and back out of it, is
          one control in the topbar — see `SettingsToggle`. The column ends where
          the nav does, and the padding below belongs to the nav. */}
      <div className="pb-2" />
    </aside>
  );
}
