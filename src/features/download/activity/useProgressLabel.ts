import { useTranslation } from "react-i18next";

import type { JobProgress } from "@/features/download/activity/progress";

/** The running job's state in words, used both as the phase line and the
 * rail's `aria-valuetext` so they can't diverge. */
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
