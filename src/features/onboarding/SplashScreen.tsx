import { AudioLines } from "lucide-react";
import { useTranslation } from "react-i18next";

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
 */
export function SplashScreen() {
  const { t } = useTranslation("onboarding");
  const { t: tCommon } = useTranslation("common");

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-5 bg-background">
      <WindowDragStrip />

      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground glow-accent">
          <AudioLines className="size-6" />
        </div>
        <span className="text-xl font-semibold tracking-tight">{tCommon("appName")}</span>
      </div>

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
    </div>
  );
}
