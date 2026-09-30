import { cn } from "@heroui/react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { SplashPhase } from "@/features/onboarding/splashPhase";
import { Swap } from "@/shared/motion/Swap";
import { durations, easings } from "@/shared/motion/tokens";
import { SonarcheMark } from "@/shared/ui/SonarcheMark";
import { WindowDragStrip } from "@/shared/ui/WindowDragStrip";

/**
 * Shown during the environment check and one beat after. Covers the whole
 * window: a clickable shell with no routable content felt broken. Only the
 * lines under the mark change between phases.
 */
export function SplashScreen({ phase }: { phase: SplashPhase }) {
  const { t } = useTranslation("onboarding");
  const { t: tCommon } = useTranslation("common");

  const waiting = phase === "checking";
  // The wordmark gives way once there's a message, to avoid the name twice.
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
        {/* A blurred disc: `glow-accent` is a box-shadow, which would halo the SVG's
            rectangle. It breathes while waiting and blooms once at the end. */}
        <div
          aria-hidden
          className={cn(
            "absolute size-32 rounded-full bg-accent/25 blur-3xl",
            waiting ? "animate-splash-halo" : "animate-splash-bloom",
          )}
        />
        <SonarcheMark className="relative size-20" />
      </motion.div>

      {/* One beat behind the mark. */}
      <motion.div
        className="flex flex-col items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: durations.medium, ease: easings.out, delay: 0.18 }}
      >
        <Swap swapKey={phase} mode="cross" className="text-2xl font-semibold tracking-tight text-nowrap">
          {headline}
        </Swap>

        {/* Fixed height: the two versions differ in size. */}
        <div className="flex h-8 items-start">
          <Swap swapKey={waiting ? "waiting" : "arrived"} mode="cross">
            {waiting ? (
              <span className="flex flex-col items-center gap-3">
                {/* Indeterminate sliver rather than a spinner. */}
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
