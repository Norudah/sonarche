import { toast } from "@heroui/react";
import { useEffect, useRef, type ComponentType } from "react";
import { useNavigate } from "react-router";

import { PipelineRail } from "@/shared/ui/PipelineRail";

/** Pins a loading toast while `show`. `Body` is mounted once, so it must
 * subscribe to its own data; `onView` opens `viewPath`. */
export function usePinnedJobToast(show: boolean, viewPath: string, Body: ComponentType<{ onView: () => void }>) {
  const navigate = useNavigate();
  // A ref, so a navigation changing `navigate`'s identity doesn't recreate the toast.
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => {
    if (!show) return;
    const id = toast(<Body onView={() => navigateRef.current(viewPath)} />, { timeout: 0, isLoading: true });
    return () => toast.close(id);
  }, [show, viewPath, Body]);
}

interface JobToastCardProps {
  title: string;
  fills: readonly number[];
  weights: readonly number[];
  activeIndex: number | null;
  /** The current stage, also the rail's accessible label. */
  line: string;
  viewLabel: string;
  onView: () => void;
}

/** The pinned toast's content. The "view" action lives here: HeroUI's action
 * slot has no room beside a full-width rail. */
export function JobToastCard({ title, fills, weights, activeIndex, line, viewLabel, onView }: JobToastCardProps) {
  return (
    // Fixed width: HeroUI lays the toast out as a row, and a flexible child
    // overflows on long titles.
    <div className="flex w-60 flex-col gap-1.5 overflow-hidden">
      <p className="truncate text-[0.8125rem] font-medium text-foreground">{title}</p>
      <PipelineRail
        fills={fills}
        weights={weights}
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
