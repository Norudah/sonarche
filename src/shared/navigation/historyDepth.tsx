import { createContext, useContext, useState, type ReactNode } from "react";
import { NavigationType, useLocation, useNavigationType } from "react-router";

/** PUSH adds one, POP removes one, REPLACE keeps the depth. Clamped at zero. */
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
 * Tracks navigation depth: the memory router exposes no history index.
 * Adjusted during render keyed on the location (idempotent under
 * StrictMode); the first location is the root, depth zero.
 */
export function HistoryDepthProvider({ children }: { children: ReactNode }) {
  const { key } = useLocation();
  const type = useNavigationType();
  const [tracked, setTracked] = useState<TrackedDepth>({ key, depth: 0 });

  if (tracked.key !== key) setTracked({ key, depth: nextDepth(tracked.depth, type) });

  return <HistoryDepthContext value={tracked.depth}>{children}</HistoryDepthContext>;
}

/** False on a cold entry, where `navigate(-1)` would leave the app. */
export function useCanGoBack(): boolean {
  return useContext(HistoryDepthContext) > 0;
}
