import { useMemo } from "react";

import { groupAlbums } from "@/features/library/albums/albums";
import { useLibrary } from "@/features/library/hooks";
import { enabledLines, useDisabledChecks } from "@/features/library/triage/enabledChecks";
import { buildTriageQueue, tallyToFix } from "@/features/library/triage/queue";

/**
 * The metadata page's headline count, for whoever mentions it from afar —
 * today the sidebar badge. Derived from the same cached listing and the same
 * predicates as the page and the explorers, so the badge can never promise a
 * different number than the page delivers — distinct things, counted once each
 * (see `tallyToFix`).
 *
 * Zero while the library is loading or empty: a badge that cannot yet know
 * its number should be absent, not wrong.
 */
export function useTriageCount(): number {
  const tracks = useLibrary().data;
  // Reads the same switches as the page: a check turned off must leave the
  // badge too, or the sidebar would keep knocking about a line the page no
  // longer shows.
  const disabled = useDisabledChecks();
  return useMemo(() => {
    if (!tracks || tracks.length === 0) return 0;
    const queue = enabledLines(buildTriageQueue(tracks, groupAlbums(tracks)), disabled);
    return tallyToFix(queue).total;
  }, [tracks, disabled]);
}
