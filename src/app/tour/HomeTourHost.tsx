import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { paths } from "@/app/routes";
import { runHomeTour } from "@/app/tour/homeTourDriver";
import { homeTourSeen, markHomeTourSeen, onHomeTourRequest } from "@/shared/lib/homeTour";

/** How long after the shell appears the first-run tour waits: past the longest
 * splash beat (`aboard`, 2400 ms) and its cross-fade, so the spotlight lands on
 * a settled window instead of opening under the curtain. */
const FIRST_RUN_DELAY_MS = 3200;

/**
 * Owns when the tour runs: once on the first launch that shows the shell
 * (right after the setup walkthrough on a fresh install), and again whenever
 * Settings asks. Mounted inside the gate, so "the shell appeared" and "this
 * mounted" are the same moment.
 */
export function HomeTourHost() {
  const { t, i18n } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

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
        // The tour points at the main nav, which settings mode swaps out —
        // step out of settings before the first spotlight looks for it.
        if (pathname.startsWith(paths.settings)) navigate(paths.download);
        setIsOpen(true);
      }),
    [pathname, navigate],
  );

  // Read through refs so the driver is not torn down and relaunched because a
  // render gave `t` or the close callback a new identity mid-tour.
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
        // Seen is seen, however it ended: a skipped tour re-offering itself on
        // every launch is nagging, and Settings holds the way back.
        markHomeTourSeen();
      },
    });
    return () => {
      if (tour.isActive()) tour.destroy();
    };
  }, [isOpen]);

  return null;
}
