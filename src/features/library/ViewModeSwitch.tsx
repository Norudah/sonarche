import { LayoutGrid, ListMusic } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";

import { parseViewMode, withViewMode, type ViewMode } from "@/features/library/viewMode";
import { layoutIds, springs } from "@/shared/motion/tokens";

/* The composer's segmented control, at filter-bar size. */
const SEGMENT =
  "relative flex items-center rounded-full px-3 py-1.5 text-[0.8125rem] font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40";

function Segment({ mode, current, children }: { mode: ViewMode; current: ViewMode; children: ReactNode }) {
  const [params] = useSearchParams();
  const isActive = current === mode;

  return (
    <Link
      to={{ search: `?${withViewMode(params, mode)}` }}
      replace
      aria-current={isActive ? "true" : undefined}
      className={SEGMENT + (isActive ? " text-accent" : " text-muted hover:text-foreground")}
    >
      {isActive && (
        <motion.span
          layoutId={layoutIds.viewMode}
          transition={springs.snappy}
          className="absolute inset-0 rounded-full bg-surface shadow-xs"
        />
      )}
      {/* Positioned so the label paints above the absolute pill. */}
      <span className="relative flex items-center gap-1.5">{children}</span>
    </Link>
  );
}

/** Overview or tracks. Links (`replace`), since the mode lives in the URL. */
export function ViewModeSwitch({ overviewLabel, tracksLabel }: { overviewLabel: string; tracksLabel: string }) {
  const [params] = useSearchParams();
  const mode = parseViewMode(params);

  return (
    <div className="flex h-9 shrink-0 flex-row items-center gap-0.5 rounded-full bg-default/60 p-0.5">
      <Segment mode="overview" current={mode}>
        <LayoutGrid className="size-3.5 shrink-0" />
        {overviewLabel}
      </Segment>
      <Segment mode="tracks" current={mode}>
        <ListMusic className="size-3.5 shrink-0" />
        {tracksLabel}
      </Segment>
    </div>
  );
}
