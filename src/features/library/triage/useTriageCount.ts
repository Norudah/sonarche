import { useMemo } from "react";

import { groupAlbums } from "@/features/library/albums/albums";
import { useLibrary } from "@/features/library/hooks";
import { buildTriageQueue, countToFix } from "@/features/library/triage/queue";

/**
 * The metadata page's headline count, for whoever mentions it from afar —
 * today the sidebar badge. Derived from the same cached listing and the same
 * predicates as the page and the explorers, so the badge can never promise a
 * different number than the page delivers.
 *
 * Zero while the library is loading or empty: a badge that cannot yet know
 * its number should be absent, not wrong.
 */
export function useTriageCount(): number {
  const tracks = useLibrary().data;
  return useMemo(() => {
    if (!tracks || tracks.length === 0) return 0;
    return countToFix(buildTriageQueue(tracks, groupAlbums(tracks)));
  }, [tracks]);
}
