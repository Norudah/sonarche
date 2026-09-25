import { MoveRight } from "lucide-react";
import type { ReactNode } from "react";

/** One square stage side, shared by both modals. */
export const STAGE_PX = 280;

/** Current image on the left, replacement on the right, shared by the cover
 * and artist-image modals. */
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
  /** Actions on the current image (reframing), apart from the source bar. */
  currentAction?: ReactNode;
  nextTitle: string;
  /** Help popover beside the "next" label. */
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
