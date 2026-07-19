import { createContext, useContext } from "react";
import type { ReactNode, RefObject } from "react";

/**
 * The app's scroll container, published so pages can observe it.
 *
 * <main> scrolls, not the window, so anything that reacts to scroll position —
 * an IntersectionObserver watching whether a banner has left the screen — needs
 * that element as its root. Passing it down as a prop would mean threading a ref
 * through every layout between the shell and the one component that wants it.
 */
const ScrollportContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function ScrollportProvider({
  value,
  children,
}: {
  value: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return <ScrollportContext.Provider value={value}>{children}</ScrollportContext.Provider>;
}

export function useScrollport(): RefObject<HTMLElement | null> {
  const ctx = useContext(ScrollportContext);
  if (!ctx) throw new Error("useScrollport must be used within a ScrollportProvider");
  return ctx;
}
