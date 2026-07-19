import { useRef } from "react";

/**
 * Ids of jobs that appeared *after* the queue was first rendered — i.e. the ones
 * the user just queued, as opposed to the history that was already there.
 *
 * Ids are never removed. The reveal is a CSS animation, which runs once and then
 * holds; dropping the id later would strip the class mid-animation and cut it
 * off. Keeping the set append-only is what makes it fire exactly once.
 */
export function useNewJobIds(ids: string[]): ReadonlySet<string> {
  const seen = useRef<Set<string> | null>(null);
  const isNew = useRef(new Set<string>());

  if (seen.current === null) {
    // First render: everything on screen is history, nothing to announce.
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
