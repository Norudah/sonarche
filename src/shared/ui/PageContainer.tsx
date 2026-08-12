import type { ReactNode } from "react";

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
 *
 * Less air above than on the other three sides: the page no longer opens on the
 * window's edge but under the topbar, and a full 2rem under a bar reads as the
 * page having come loose from it. The heroes cancel this padding to bleed their
 * wash edge to edge, so their `-mt-5` has to keep matching whatever is set here.
 *
 * No `WindowDragStrip` any more. It existed because the overlay title bar left
 * nothing to grab at the top of the window; the topbar is that band now, and the
 * strip was an invisible 2rem layer over the top of every page — it had already
 * cost the Metadata page's switch its clicks (see `TriageHero`).
 */
export function PageContainer({ children, sticky }: PageContainerProps) {
  return (
    <>
      {sticky && <div className="sticky top-0 z-20 h-0">{sticky}</div>}
      <div className="relative flex flex-col gap-6 px-8 pt-5 pb-8">{children}</div>
    </>
  );
}
