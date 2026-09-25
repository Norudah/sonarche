import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { useLocation, useNavigationType } from "react-router";

/**
 * Scroll restoration for `<main>`, which React Router's `ScrollRestoration`
 * doesn't handle (it drives the window). Forward navigation goes to the top;
 * back restores the previous offset.
 */
export function useScrollRestoration(ref: RefObject<HTMLElement | null>): void {
  const { key } = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map<string, number>());

  // Recorded continuously: by cleanup time on a POP the container has re-rendered.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const remember = () => positions.current.set(key, element.scrollTop);
    element.addEventListener("scroll", remember, { passive: true });
    return () => element.removeEventListener("scroll", remember);
  }, [ref, key]);

  // Before paint, or the wrong offset shows for a frame.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.scrollTop = navigationType === "POP" ? (positions.current.get(key) ?? 0) : 0;
  }, [ref, key, navigationType]);
}
