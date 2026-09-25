import { useRef } from "react";

/** Ids of jobs that appeared after the first render. Append-only so the CSS
 * reveal animation isn't cut off. */
export function useNewJobIds(ids: string[]): ReadonlySet<string> {
  const seen = useRef<Set<string> | null>(null);
  const isNew = useRef(new Set<string>());

  if (seen.current === null) {
    // First render: existing jobs are history.
    seen.current = new Set(ids);
  } else {
    for (const id of ids) {
      if (!seen.current.has(id)) {
        seen.current.add(id);
        isNew.current.add(id);
      }
    }
  }

  return isNew.current;
}
