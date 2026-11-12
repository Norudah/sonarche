import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { runHomeTour } from "@/app/tour/homeTourDriver";
import { homeTourSeen, markHomeTourSeen, onHomeTourRequest } from "@/shared/lib/homeTour";
import { closeSettings } from "@/shared/lib/settingsDialog";

/** Waits out the setup's entrance into the app (3.7 s, see `entrance.ts`):
 * the shell mounts under it as it starts. */
const FIRST_RUN_DELAY_MS = 4400;

/** Runs the tour on the first launch that shows the shell, and on request from Settings. */
export function HomeTourHost() {
  const { t, i18n } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    void homeTourSeen().then((seen) => {
      if (seen || cancelled) return;
      timer = window.setTimeout(() => setIsOpen(true), FIRST_RUN_DELAY_MS);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(
    () =>
      onHomeTourRequest(() => {
        // The settings dialog would cover the first spotlight target.
        closeSettings();
        setIsOpen(true);
      }),
    [],
  );

  // Refs keep the driver alive across renders.
  const tRef = useRef(t);
  const languageRef = useRef(i18n.language);
  useEffect(() => {
    tRef.current = t;
    languageRef.current = i18n.language;
  });

  useEffect(() => {
    if (!isOpen) return;
    const tour = runHomeTour({
      t: tRef.current,
      language: languageRef.current,
      onClose: () => {
        setIsOpen(false);
        // However it ended; Settings can replay it.
        markHomeTourSeen();
      },
    });
    return () => {
      if (tour.isActive()) tour.destroy();
    };
  }, [isOpen]);

  return null;
}
