import { useMemo } from "react";

import { groupAlbums } from "@/features/library/albums/albums";
import { useLibrary } from "@/features/library/hooks";
import { enabledLines, useDisabledChecks } from "@/features/library/triage/enabledChecks";
import { buildTriageQueue, tallyToFix } from "@/features/library/triage/queue";

/** The Metadata headline count for the sidebar badge, from the same predicates.
 * Zero while loading or empty. */
export function useTriageCount(): number {
  const tracks = useLibrary().data;
  // Disabled checks leave the badge too.
  const disabled = useDisabledChecks();
  return useMemo(() => {
    if (!tracks || tracks.length === 0) return 0;
    const queue = enabledLines(buildTriageQueue(tracks, groupAlbums(tracks)), disabled);
    return tallyToFix(queue).total;
  }, [tracks, disabled]);
}
