import { cn } from "@heroui/react";
import { ChevronLeft, Disc, Download, FileText, History, Layers, Mic2, Music, Settings, Tags } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation, useNavigate } from "react-router";

import { paths } from "@/app/routes";
import { settingsCategories } from "@/features/settings/categories";
import { layoutIds, springs } from "@/shared/motion/tokens";
import { SonarcheMark } from "@/shared/ui/SonarcheMark";

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  indicatorId = layoutIds.navIndicator,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
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

/** The everyday navigation: Explorer + Arche. */
function MainNav() {
  const { t } = useTranslation("common");
  const { t: tLibrary } = useTranslation("library");

  return (
    <div className="flex flex-col">
      <NavSection label={t("nav.sections.explorer")}>
        <NavItem to={paths.download} label={t("nav.download")} icon={Download} end />
        <NavItem to={paths.history} label={t("nav.history")} icon={History} />
        <NavItem to={paths.metadata} label={t("nav.metadata")} icon={FileText} />
      </NavSection>

      <Divider />

      <NavSection label={t("nav.sections.arche")}>
        <NavItem to={paths.libraryTracks} label={tLibrary("views.tracks")} icon={Music} />
        <NavItem to={paths.libraryAlbums} label={tLibrary("views.albums")} icon={Disc} />
        <NavItem to={paths.libraryArtists} label={tLibrary("views.artists")} icon={Mic2} />
        <NavItem to={paths.libraryGenres} label={tLibrary("views.genres")} icon={Layers} />
        <NavItem to={paths.libraryCategories} label={tLibrary("views.categories")} icon={Tags} />
      </NavSection>
    </div>
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
  const { t: tSettings } = useTranslation("settings");
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const inSettings = pathname.startsWith(paths.settings);

  // Where the back arrow returns to: the last place that wasn't settings. Kept
  // in a ref and updated only while outside settings, so switching categories
  // (all under /settings) never overwrites the exit target. An effect because
  // it records navigation history — an external timeline, not render output.
  const exitTarget = useRef<string>(paths.download);
  useEffect(() => {
    if (!inSettings) exitTarget.current = pathname;
  }, [inSettings, pathname]);

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
            "absolute inset-0 px-3 transition-opacity duration-200 ease-out",
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

      {/* The bottom entry keeps its spot and only its face changes: the settings
          link in the app, a back control in settings — same cross-fade as the
          nav above. The link stays in flow to give the row its height; the back
          button overlays it. */}
      <div className="relative px-3 pt-2 pb-4">
        <div
          className={cn(
            "transition-opacity duration-200 ease-out",
            inSettings ? "pointer-events-none opacity-0" : "opacity-100",
          )}
          aria-hidden={inSettings}
        >
          <NavItem to={paths.settings} label={tSettings("title")} icon={Settings} />
        </div>
        <button
          type="button"
          onClick={() => navigate(exitTarget.current)}
          className={cn(
            "group absolute inset-x-3 top-2 flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-opacity duration-200 ease-out hover:bg-default/40",
            inSettings ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-hidden={!inSettings}
        >
          <ChevronLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
          <span>{tSettings("back")}</span>
        </button>
      </div>
    </aside>
  );
}
