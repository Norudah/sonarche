import { openUrl } from "@tauri-apps/plugin-opener";
import { driver, type Driver } from "driver.js";
import type { TFunction } from "i18next";

import { guideUrl } from "@/shared/lib/siteLinks";

import "driver.js/dist/driver.css";

/**
 * The guided tour, on driver.js — the web's standard spotlight engine — rather
 * than a hand-rolled overlay: positioning, the SVG cutout, keyboard travel and
 * step lifecycle are exactly the wheels not worth reinventing. What stays ours
 * is the content (six stops over the app's fixed chrome, anchored on
 * `data-tour` attributes) and the dress (the `sonarche-tour` block in
 * `theme.css`, on the app's own tokens so both themes follow).
 */

interface HomeTourInput {
  t: TFunction<"common">;
  /** For the guide link on the closing step. */
  language: string;
  /** Fired once, however the tour ends — finish, close, Escape, overlay. */
  onClose: () => void;
}

const STOPS = [
  { id: "explorer", side: "right" },
  { id: "arche", side: "right" },
  { id: "playlists", side: "right" },
  { id: "chrome", side: "bottom", align: "end" },
  { id: "player", side: "top", align: "center" },
  // No element: driver.js centres the popover over the full overlay — the
  // closing card, where the guide link lives.
  { id: "finale" },
] as const;

export function runHomeTour({ t, language, onClose }: HomeTourInput): Driver {
  const tour = driver({
    showProgress: true,
    // Language-neutral on purpose; the words around it are translated.
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
