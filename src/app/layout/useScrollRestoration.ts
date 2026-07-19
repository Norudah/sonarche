import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { useLocation, useNavigationType } from "react-router";

/**
 * Keeps the scroll position honest across navigation.
 *
 * React Router's own `ScrollRestoration` drives the *window*, and this app does
 * not scroll the window: `<main>` is the scroll container, so nothing was
 * resetting it. Leaving a page scrolled halfway down and opening another landed
 * you halfway down the new one, which read as the page "jumping" on arrival.
 *
 * Forward navigation goes to the top; going back restores where you were, which
 * is the whole point of a browsable grid — returning from an album must not
 * dump you at the top of the shelf you had scrolled through.
 */
export function useScrollRestoration(ref: RefObject<HTMLElement | null>): void {
  const { key } = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map<string, number>());

  // Recorded as it happens rather than on the way out: by the time the effect
  // cleanup runs for a POP, the container has already been re-rendered.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const remember = () => positions.current.set(key, element.scrollTop);
    element.addEventListener("scroll", remember, { passive: true });
    return () => element.removeEventListener("scroll", remember);
  }, [ref, key]);

  // Layout effect, not a plain one: this has to land before the browser paints,
  // or the user sees the wrong offset for a frame — the jump we are fixing.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.scrollTop = navigationType === "POP" ? (positions.current.get(key) ?? 0) : 0;
  }, [ref, key, navigationType]);
}
