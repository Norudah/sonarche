import { openUrl } from "@tauri-apps/plugin-opener";
import { driver, type Driver } from "driver.js";
import type { TFunction } from "i18next";

import { guideUrl } from "@/shared/lib/siteLinks";

import "driver.js/dist/driver.css";

/** Guided tour on driver.js, anchored on `data-tour` attributes and styled by
 * the `sonarche-tour` block in `theme.css`. */

interface HomeTourInput {
  t: TFunction<"common">;
  language: string;
  /** Fired once, however the tour ends. */
  onClose: () => void;
}

const STOPS = [
  { id: "explorer", side: "right" },
  { id: "arche", side: "right" },
  { id: "playlists", side: "right" },
  { id: "chrome", side: "bottom", align: "end" },
  { id: "player", side: "top", align: "center" },
  // No element: a centred closing card.
  { id: "finale" },
] as const;

export function runHomeTour({ t, language, onClose }: HomeTourInput): Driver {
  const tour = driver({
    showProgress: true,
    progressText: "{{current}} / {{total}}",
    nextBtnText: t("tour.next"),
    prevBtnText: t("tour.back"),
    doneBtnText: t("tour.finish"),
    stagePadding: 6,
    stageRadius: 12,
    overlayOpacity: 0.6,
    popoverClass: "sonarche-tour",
    onDestroyed: () => onClose(),
    onPopoverRender: (popover, { state }) => {
      if (state.activeIndex !== STOPS.length - 1) return;
      const guide = document.createElement("button");
      guide.type = "button";
      guide.className = "sonarche-tour-guide";
      guide.innerText = t("tour.openGuide");
      guide.addEventListener("click", () => void openUrl(guideUrl(language)));
      popover.footerButtons.prepend(guide);
    },
    steps: STOPS.map((stop) => ({
      element: "id" in stop && stop.id !== "finale" ? `[data-tour="${stop.id}"]` : undefined,
      popover: {
        title: t(`tour.${stop.id}.title`),
        description: t(`tour.${stop.id}.body`),
        ...("side" in stop ? { side: stop.side } : {}),
        ...("align" in stop ? { align: stop.align } : {}),
      },
    })),
  });

  tour.drive();
  return tour;
}
