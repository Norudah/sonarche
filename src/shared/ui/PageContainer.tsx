import type { ReactNode } from "react";

import { WindowDragStrip } from "@/shared/ui/WindowDragStrip";

interface PageContainerProps {
  children: ReactNode;
  /**
   * Pinned to the top of the scrollport while the page scrolls under it.
   *
   * A slot rather than something the page renders itself: it has to sit outside
   * the page padding, otherwise it is inset by 2rem and content scrolls visibly
   * through the gutters beside it.
   *
   * The wrapper only positions, and it takes no height at all: it overlays the
   * page rather than sitting above it in the flow. Padding and background
   * belong to what goes in here.
   *
   * `h-0` is what makes a bar that appears on scroll possible. In the flow, the
   * bar's own height pushed the page down as it appeared, which slid whatever
   * triggered it back into view, which took the bar away, which let the page
   * back up — an oscillation that read as an animation stuttering and
   * restarting. Nothing here may move the content it is watching.
   */
  sticky?: ReactNode;
}

/**
 * Owns the page padding, which <main> deliberately does not — see AppLayout.
 */
export function PageContainer({ children, sticky }: PageContainerProps) {
  return (
    <>
      {sticky && <div className="sticky top-0 z-20 h-0">{sticky}</div>}
      <div className="relative flex flex-col gap-6 p-8">
        <WindowDragStrip />
        {children}
      </div>
    </>
  );
}
