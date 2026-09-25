import { useEffect, useState } from "react";

import { useScrollport } from "@/shared/ui/Scrollport";

/**
 * Whether the element has scrolled out of the scrollport (an
 * IntersectionObserver rooted at <main>, not the viewport). A callback ref,
 * since the element mounts after a loading spinner.
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
