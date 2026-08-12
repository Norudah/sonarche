import { MoveRight } from "lucide-react";
import type { ReactNode } from "react";

/** One stage side, square. Shared so both modals draw the same geometry. */
export const STAGE_PX = 280;

/**
 * The comparison at the heart of both replacement modals: what is worn today
 * on the left, the replacement on the right, an arrow in between. The slots
 * carry what differs (a cover, a disc, their info lines); the geometry and
 * labels' dress never do.
 */
export function BeforeAfter({
  currentTitle,
  current,
  currentInfo,
  currentAction,
  nextTitle,
  help,
  next,
  nextInfo,
}: {
  currentTitle: string;
  current: ReactNode;
  currentInfo: ReactNode;
  /** What can still be done with the image already worn — reframing it. Under
   * its own pane rather than in the source bar: the bar is where a *new*
   * image comes from, and this one is already here. */
  currentAction?: ReactNode;
  nextTitle: string;
  /** The help popover beside the "next" label. */
  help?: ReactNode;
  next: ReactNode;
  nextInfo: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
      <section className="flex flex-col items-center gap-2.5">
        <h3 className="self-start text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">
          {currentTitle}
        </h3>
        {current}
        <div className="w-full text-[0.75rem] leading-relaxed text-muted">{currentInfo}</div>
        {currentAction}
      </section>

      <MoveRight className="mt-32 size-5 shrink-0 text-muted/50" />

      <section className="flex flex-col items-center gap-2.5">
        <h3 className="flex items-center gap-1.5 self-start text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">
          {nextTitle}
          {help}
        </h3>
        {next}
        <div className="w-full text-[0.75rem] leading-relaxed text-muted">{nextInfo}</div>
      </section>
    </div>
  );
}
