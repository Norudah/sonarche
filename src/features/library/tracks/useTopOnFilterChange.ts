import { useEffect, useRef } from "react";

import { useScrollport } from "@/shared/ui/Scrollport";

/** Scrolls to the top when the result set changes (the browser would clamp to
 * the end of the matches). Skips the first run so restoration isn't fought. */
export function useTopOnFilterChange(key: string) {
  const scrollport = useScrollport();
  const previous = useRef(key);

  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    scrollport.current?.scrollTo({ top: 0 });
  }, [key, scrollport]);
}
