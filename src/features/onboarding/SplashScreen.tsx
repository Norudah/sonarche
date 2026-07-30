import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { durations, easings } from "@/shared/motion/tokens";
import { SonarcheMark } from "@/shared/ui/SonarcheMark";
import { WindowDragStrip } from "@/shared/ui/WindowDragStrip";

/**
 * Shown while the app checks its Python environment, before anything is safe to
 * interact with.
 *
 * It deliberately covers the whole window, chrome included. The check used to
 * run behind the shell, so the sidebar was on screen and clickable while no
 * route could render anything: clicking a nav item moved the active pill and
 * left a spinner, which reads as the app ignoring you. Either the chrome is
 * live or it is not — a half-interactive shell is worse than an honest wait.
 *
 * The mark, and not a stand-in icon. This is the first thing the app shows and
 * often the longest single moment a user spends looking at one screen of it, so
 * it is the worst possible place for a generic glyph. Same arrangement as the
 * sidebar — mark, no tile, wordmark beside it — scaled up and stacked, so the
 * splash reads as the app's own opening rather than as a different product.
 */
export function SplashScreen() {
  const { t } = useTranslation("onboarding");
  const { t: tCommon } = useTranslation("common");

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-7 bg-background">
      <WindowDragStrip />

      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: durations.medium, ease: easings.out }}
      >
        <div className="relative flex items-center justify-center">
          {/* A blurred disc behind the mark rather than `glow-accent`: that
              utility is a box-shadow, and a box-shadow under a transparent SVG
              haloes the rectangle the SVG occupies instead of the ship inside
              it. It breathes, slowly, because it is the only thing on screen
              allowed to say "still working" besides the bar below. */}
          <div aria-hidden className="absolute size-32 rounded-full bg-accent/25 blur-3xl animate-splash-halo" />
          <SonarcheMark className="relative size-20" />
        </div>
        <span className="text-2xl font-semibold tracking-tight">{tCommon("appName")}</span>
      </motion.div>

      {/* One beat behind the mark: the wait is the app's business, and naming it
          before the app has finished introducing itself puts the two on equal
          footing. */}
      <motion.div
        className="flex flex-col items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: durations.medium, ease: easings.out, delay: 0.18 }}
      >
        {/* An indeterminate sliver rather than a spinner: the wait is short and
         * this reads as the app working, not as the app stalling. */}
        <div
          role="progressbar"
          aria-label={t("splash.checking")}
          className="h-0.5 w-40 overflow-hidden rounded-full bg-default"
        >
          <div className="h-full w-1/3 rounded-full bg-accent animate-splash-bar" />
        </div>

        <p className="text-[0.8125rem] text-muted">{t("splash.checking")}</p>
      </motion.div>
    </div>
  );
}
