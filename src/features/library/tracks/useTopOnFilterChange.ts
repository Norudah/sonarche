import { useEffect, useRef } from "react";

import { useScrollport } from "@/shared/ui/Scrollport";

/**
 * Send the scrollport back to the top when the result set changes.
 *
 * Filtering shortens the page, and the browser only clamps the scroll offset to
 * the new maximum — so searching from halfway down a large library lands the
 * user at the *end* of the matches instead of the first one. Barely visible on
 * a short list, plainly wrong on a big one: from 290 000px into a 10 000-track
 * library, a search landed on match 820 of 835.
 *
 * Skips the first run: mounting the table is not a filter change, and resetting
 * there would fight any scroll position being restored.
 */
export function useTopOnFilterChange(key: string) {
  const scrollport = useScrollport();
  const previous = useRef(key);

  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    scrollport.current?.scrollTo({ top: 0 });
  }, [key, scrollport]);
}
