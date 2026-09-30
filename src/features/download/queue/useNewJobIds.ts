import { useState } from "react";

/** Ids of jobs that appeared after the first render. Append-only so the CSS
 * reveal animation isn't cut off. */
export function useNewJobIds(ids: string[]): ReadonlySet<string> {
  // First render: existing jobs are history.
  const [seen, setSeen] = useState(() => new Set(ids));
  const [isNew, setIsNew] = useState<ReadonlySet<string>>(() => new Set());

  const arrived = ids.filter((id) => !seen.has(id));
  if (arrived.length > 0) {
    setSeen(new Set([...seen, ...arrived]));
    setIsNew(new Set([...isNew, ...arrived]));
  }

  return isNew;
}
