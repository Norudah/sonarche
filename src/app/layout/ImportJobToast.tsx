import { toast } from "@heroui/react";
import { useMutationState } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { matchPath, useLocation, useNavigate } from "react-router";

import { paths } from "@/app/routes";
import type { ImportOutcome } from "@/features/import/api";
import { importRunKey, useImportProgress } from "@/features/import/hooks";
import { STAGE_WEIGHTS } from "@/features/import/stages";
import { TOAST_EXPLAINED, TOAST_GLANCE } from "@/shared/toast/durations";
import { PipelineRail } from "@/shared/ui/PipelineRail";

/**
 * The running folder import, kept in sight away from its page — the sibling of
 * `DownloadJobToast`, fed by the mutation the import page fires (found through
 * its key) and by the sidecar's own progress events.
 *
 * Leaner than the page's rail on purpose: the scan report — which is what
 * turns "folder 3" into "folder 3 of 12" — lives in the page's state, so out
 * here the copy stage sweeps instead of filling. The covers stage counts its
 * own total and fills for real.
 */

function ratio(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, done / total));
}

function LiveImportToast({ onView, viewLabel }: { onView: () => void; viewLabel: string }) {
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
    // Hard width for the same reason as the download toast: the row layout
    // around this slot overflows when a flexible child carries a long line.
    <div className="flex w-60 flex-col gap-1.5 overflow-hidden">
      <p className="truncate text-[0.8125rem] font-medium text-foreground">{t("toast.title")}</p>
      <PipelineRail
        fills={fills}
        weights={STAGE_WEIGHTS}
        activeIndex={activeIndex}
        failedIndex={null}
        tone="accent"
        label={line}
      />
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-[0.75rem] text-muted">{line}</p>
        <button
          type="button"
          onClick={onView}
          className="shrink-0 cursor-pointer text-[0.75rem] font-medium text-accent outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {viewLabel}
        </button>
      </div>
    </div>
  );
}

export function useImportJobToast() {
  const { t } = useTranslation("import");
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const states = useMutationState({ filters: { mutationKey: importRunKey } });
  const last = states[states.length - 1];
  const importing = last?.status === "pending";
  const onImportPage = matchPath(paths.import, pathname) != null;
  const show = importing && !onImportPage;

  const navigateRef = useRef(navigate);
  const tRef = useRef(t);
  useEffect(() => {
    navigateRef.current = navigate;
    tRef.current = t;
  });

  useEffect(() => {
    if (!show) return;
    const id = toast(
      <LiveImportToast viewLabel={tRef.current("toast.view")} onView={() => navigateRef.current(paths.import)} />,
      { timeout: 0, isLoading: true },
    );
    return () => toast.close(id);
  }, [show]);

  // The outcome, when it lands out of sight — the import page has its own recap.
  const wasImporting = useRef(false);
  useEffect(() => {
    const ended = wasImporting.current && !importing;
    wasImporting.current = importing;
    if (!ended || onImportPage) return;
    if (last?.status === "success") {
      const outcome = last.data as ImportOutcome;
      if (outcome.cancelled) {
        toast.warning(tRef.current("toast.cancelled"), { timeout: TOAST_GLANCE });
      } else {
        toast.success(tRef.current("toast.done"), { timeout: TOAST_GLANCE });
      }
    } else if (last?.status === "error") {
      toast.danger(tRef.current("toast.failed"), { timeout: TOAST_EXPLAINED });
    }
  }, [importing, onImportPage, last]);
}
