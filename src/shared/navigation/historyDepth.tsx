import { createContext, useContext, useState, type ReactNode } from "react";
import { NavigationType, useLocation, useNavigationType } from "react-router";

/**
 * How many entries deep into the session this location is.
 *
 * PUSH stacks one, POP unstacks one, REPLACE is the same visit seen differently
 * — which is what makes a filter chip free: the chips replace, so twenty flips
 * still leave one entry to step back over.
 *
 * Clamped at zero rather than trusted: the app has no forward control, so a POP
 * is always a step back, but a hand-driven one at the root must not push the
 * count negative and hide every back button for the rest of the session.
 */
export function nextDepth(depth: number, type: NavigationType): number {
  if (type === NavigationType.Push) return depth + 1;
  if (type === NavigationType.Pop) return Math.max(0, depth - 1);
  return depth;
}

const HistoryDepthContext = createContext(0);

interface TrackedDepth {
  key: string;
  depth: number;
}

/**
 * Counts the session's navigation depth for whoever needs to know whether
 * there is anywhere to go back to.
 *
 * The router is a memory router — there is no `history.state.idx` to read and
 * no browser chrome to fall back on, so a back affordance has to count for
 * itself. The count is adjusted during render off the location key rather than
 * in an effect: it is accumulated state, not derivable from this render alone,
 * and the key guard makes the adjustment idempotent under StrictMode's double
 * invoke. The first location seen is the session's root and adjusts nothing,
 * which is exactly what makes a cold start report zero.
 */
export function HistoryDepthProvider({ children }: { children: ReactNode }) {
  const { key } = useLocation();
  const type = useNavigationType();
  const [tracked, setTracked] = useState<TrackedDepth>({ key, depth: 0 });

  // React restarts this component before committing, so the value below is
  // already the adjusted one — no extra frame, no effect, no flash of a stale
  // count on the render that navigated.
  if (tracked.key !== key) setTracked({ key, depth: nextDepth(tracked.depth, type) });

  return <HistoryDepthContext value={tracked.depth}>{children}</HistoryDepthContext>;
}

/**
 * Whether stepping back lands somewhere inside the app.
 *
 * False on a cold entry — a restored session, a dev `?route=` deep link — where
 * `navigate(-1)` would leave the webview rather than move the user. Callers
 * show their back control only when this is true: a page reached directly has
 * nowhere behind it, and a button that does nothing is worse than no button.
 */
export function useCanGoBack(): boolean {
  return useContext(HistoryDepthContext) > 0;
}
