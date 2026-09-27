import { toast } from "@heroui/react";
import { useMutationState } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { matchPath, useLocation } from "react-router";

import { JobToastCard, usePinnedJobToast } from "@/app/layout/jobToast";
import { paths } from "@/app/routes";
import type { ImportOutcome } from "@/features/import/api";
import { importRunKey, useImportProgress } from "@/features/import/hooks";
import { STAGE_WEIGHTS } from "@/features/import/stages";
import { TOAST_EXPLAINED, TOAST_GLANCE } from "@/shared/toast/durations";

function ratio(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, done / total));
}

function LiveImportToast({ onView }: { onView: () => void }) {
  const { t } = useTranslation("import");
  const progress = useImportProgress(true);

  const covers = progress?.stage === "covers" ? progress : null;
  const fills: [number, number, number] = covers ? [1, 1, ratio(covers.done, covers.total)] : [1, 0, 0];
  const activeIndex = covers ? 2 : 1;
  const stage = t(covers ? "stages.covers" : "stages.copy");
  const counter = covers
    ? t("coversProgress", { done: covers.done, total: covers.total })
    : progress?.stage === "copying"
      ? t("toast.folders", { count: progress.folders })
      : null;
  const line = counter == null ? stage : `${stage} · ${counter}`;

  return (
    <JobToastCard
      title={t("toast.title")}
      fills={fills}
      weights={STAGE_WEIGHTS}
      activeIndex={activeIndex}
      line={line}
      viewLabel={t("toast.view")}
      onView={onView}
    />
  );
}

export function useImportJobToast() {
  const { t } = useTranslation("import");
  const { pathname } = useLocation();

  const states = useMutationState({ filters: { mutationKey: importRunKey } });
  const last = states[states.length - 1];
  const importing = last?.status === "pending";
  const onImportPage = matchPath(paths.import, pathname) != null;
  const show = importing && !onImportPage;

  usePinnedJobToast(show, paths.import, LiveImportToast);

  const wasImporting = useRef(false);
  useEffect(() => {
    const ended = wasImporting.current && !importing;
    wasImporting.current = importing;
    if (!ended || onImportPage) return;
    if (last?.status === "success") {
      const outcome = last.data as ImportOutcome;
      if (outcome.cancelled) {
        toast.warning(t("toast.cancelled"), { timeout: TOAST_GLANCE });
      } else {
        toast.success(t("toast.done"), { timeout: TOAST_GLANCE });
      }
    } else if (last?.status === "error") {
      toast.danger(t("toast.failed"), { timeout: TOAST_EXPLAINED });
    }
  }, [importing, onImportPage, last, t]);
}
