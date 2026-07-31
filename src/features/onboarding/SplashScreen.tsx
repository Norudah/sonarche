import { cn } from "@heroui/react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { SplashPhase } from "@/features/onboarding/splashPhase";
import { Swap } from "@/shared/motion/Swap";
import { durations, easings } from "@/shared/motion/tokens";
import { SonarcheMark } from "@/shared/ui/SonarcheMark";
import { WindowDragStrip } from "@/shared/ui/WindowDragStrip";

/**
 * Shown while the app checks its Python environment, and for one beat after the
 * answer comes back.
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
 *
 * The phase changes the two lines under the mark and nothing else. That is the
 * whole trick: the ark holds still while the words move, so the closing beat
 * reads as this screen finishing its sentence rather than as a second screen
 * arriving to say goodbye.
 */
export function SplashScreen({ phase }: { phase: SplashPhase }) {
  const { t } = useTranslation("onboarding");
  const { t: tCommon } = useTranslation("common");

  const waiting = phase === "checking";
  // The wordmark is the app introducing itself, and it steps aside once the app
  // has something to say instead — "Welcome to Sonarche" under a "Sonarche"
  // would be the name twice in two lines.
  const headline = waiting ? tCommon("appName") : t(`splash.${phase}.title`);

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-5 bg-background">
      <WindowDragStrip />

      <motion.div
        className="relative flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: durations.medium, ease: easings.out }}
      >
        {/* A blurred disc behind the mark rather than `glow-accent`: that
            utility is a box-shadow, and a box-shadow under a transparent SVG
            haloes the rectangle the SVG occupies instead of the ship inside it.
            It breathes while the app is working and blooms once when the wait
            is over — the light coming up on the ark is most of what makes the
            closing beat worth having. */}
        <div
          aria-hidden
          className={cn(
            "absolute size-32 rounded-full bg-accent/25 blur-3xl",
            waiting ? "animate-splash-halo" : "animate-splash-bloom",
          )}
        />
        <SonarcheMark className="relative size-20" />
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
        <Swap swapKey={phase} mode="cross" className="text-2xl font-semibold tracking-tight text-nowrap">
          {headline}
        </Swap>

        {/* Fixed height, because the two versions of this row are not the same
            size and a collapsing box would jog the mark above it mid-crossover. */}
        <div className="flex h-8 items-start">
          <Swap swapKey={waiting ? "waiting" : "arrived"} mode="cross">
            {waiting ? (
              <span className="flex flex-col items-center gap-3">
                {/* An indeterminate sliver rather than a spinner: the wait is
                    short and this reads as the app working, not as the app
                    stalling. */}
                <span
                  role="progressbar"
                  aria-label={t("splash.checking")}
                  className="block h-0.5 w-40 overflow-hidden rounded-full bg-default"
                >
                  <span className="block h-full w-1/3 rounded-full bg-accent animate-splash-bar" />
                </span>
                <span className="text-[0.8125rem] text-muted">{t("splash.checking")}</span>
              </span>
            ) : (
              <span className="text-[0.8125rem] text-muted">{t(`splash.${phase}.subtitle`)}</span>
            )}
          </Swap>
        </div>
      </motion.div>
    </div>
  );
}
