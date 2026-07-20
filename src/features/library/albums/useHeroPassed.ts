import { useEffect, useState } from "react";

import { useScrollport } from "@/shared/ui/Scrollport";

/**
 * Whether the element the returned ref is attached to has scrolled out of view.
 *
 * An IntersectionObserver rather than a scroll listener: the question is "is
 * this still on screen", which is exactly what the observer answers, and it
 * answers it off the main thread instead of on every scroll frame.
 *
 * The root is the app's scrollport, not the viewport — <main> sits below the
 * topbar, so an element that has left <main> is still inside the window and the
 * default root would report it visible for another topbar's worth of scrolling.
 *
 * A callback ref, not a ref object, and that part is load-bearing: the page
 * renders a spinner while the library loads, so the observed element does not
 * exist on the first commit. An effect reading `ref.current` would find null,
 * bail, and never run again — the ref filling in later is not a render. The
 * callback fires when the node actually arrives, and the effect keys off it.
 */
export function useHeroPassed<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const scrollport = useScrollport();
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setPassed(!entry.isIntersecting), {
      root: scrollport.current,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, scrollport]);

  return { ref: setNode, passed };
}
