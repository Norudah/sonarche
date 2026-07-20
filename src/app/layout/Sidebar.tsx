import { cn } from "@heroui/react";
import { AudioLines, Disc, Download, FileText, Layers, Mic2, Music, Settings } from "lucide-react";
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
              layoutId={layoutIds.navIndicator}
              transition={springs.snappy}
              className="absolute inset-0 rounded-lg bg-accent/15"
            />
          )}
          <Icon className="relative size-4 shrink-0" />
          <span className="relative">{label}</span>
        </>
      )}
    </NavLink>
  );
}

function NavSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* A shade lighter and a hair smaller than the items they head: these are
          signposts, and they should be found when looked for rather than read
          on the way past. */}
      <p className="px-3 text-[10px] font-semibold tracking-widest text-muted/70 uppercase">{label}</p>
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

export function Sidebar() {
  const { t } = useTranslation("common");
  const { t: tLibrary } = useTranslation("library");
  const { t: tSettings } = useTranslation("settings");

  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-separator bg-surface">
      {/* The window has no native title bar any more, so this strip is what the
          user grabs to move it — and, being top-left, it is also where macOS
          paints the traffic lights over our webview. Their own distance from
          the window corner is `trafficLightPosition` in tauri.conf.json, not
          this padding — that was the wrong lever the first time round. `pt-14`
          is just their vertical clearance, so the logo sits comfortably below
          them rather than crowding the same row.

          `pointer-events-none` on the contents because a drag region only
          reacts to presses that land on the element carrying the attribute,
          and a press on the logo or the wordmark would otherwise do nothing. */}
      <div data-tauri-drag-region className="flex items-center gap-3 px-6 pt-14 pb-7">
        <div className="pointer-events-none flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <AudioLines className="size-4.5" />
        </div>
        <span className="pointer-events-none text-[15px] font-semibold tracking-tight">{t("appName")}</span>
      </div>

      {/* `flex-1` so the settings entry below is pushed to the floor of the
          sidebar rather than trailing the last nav item. */}
      <div className="flex-1 px-3">
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
      </div>

      {/* Settings is a destination like any other, so it is a nav item and not
          a floating icon — just the one that belongs at the bottom, out of the
          path of the things used all day. */}
      <div className="px-3 pt-2 pb-4">
        <NavItem to={paths.settings} label={tSettings("title")} icon={Settings} />
      </div>
    </aside>
  );
}
