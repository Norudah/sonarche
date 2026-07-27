import { useTranslation } from "react-i18next";

import type { JobProgress } from "@/features/download/activity/progress";

/**
 * The running job's state in words — "Récupération · 2 sur 5".
 *
 * A hook rather than a formatter inside the card, because the same string is
 * both the visible phase line and the rail's `aria-valuetext`: a progress bar
 * that announces "43" tells a screen reader nothing, and the two must not be
 * allowed to drift into saying different things.
 */
export function useProgressLabel(): (progress: JobProgress) => string {
  const { t } = useTranslation("download");

  return (progress) => {
    const phase = t(`activity.phase.${progress.phase}`);
    const { detail } = progress;
    if (!detail) return phase;
    const figure =
      detail.kind === "percent"
        ? t("activity.percent", { value: detail.value })
        : t("activity.outOf", { done: detail.done, total: detail.total });
    return `${phase} · ${figure}`;
  };
}
