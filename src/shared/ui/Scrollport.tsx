import { createContext, useContext } from "react";
import type { ReactNode, RefObject } from "react";

/** The scroll container (<main>, not the window), for IntersectionObserver roots. */
const ScrollportContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function ScrollportProvider({ value, children }: { value: RefObject<HTMLElement | null>; children: ReactNode }) {
  return <ScrollportContext.Provider value={value}>{children}</ScrollportContext.Provider>;
}

export function useScrollport(): RefObject<HTMLElement | null> {
  const ctx = useContext(ScrollportContext);
  if (!ctx) throw new Error("useScrollport must be used within a ScrollportProvider");
  return ctx;
}
