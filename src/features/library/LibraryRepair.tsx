import { useQuery, useQueryClient } from "@tanstack/react-query";

import { remuxLibrary } from "@/features/library/api";
import { libraryKey, useLibrary } from "@/features/library/hooks";

const repairKey = ["library-repair"] as const;

/**
 * Fires the fragmented-m4a repair pass once per launch and renders nothing.
 *
 * Gated on the library listing having loaded: the shell mounts this under the
 * splash while the environment check is still in flight, and a loaded listing
 * is the proof the sidecar is up — without poking at the onboarding feature's
 * env state from here.
 *
 * A query rather than a mount effect + mutation on purpose: StrictMode mounts
 * twice, and the query cache dedupes the second call where an effect would
 * fire it into the backend's "already running" rejection. `retry: false`
 * because the pass re-runs on next launch anyway — retrying a long remux is
 * how one repair becomes two.
 */
export function LibraryRepair() {
  const queryClient = useQueryClient();
  const library = useLibrary();
  useQuery({
    queryKey: repairKey,
    queryFn: async () => {
      const report = await remuxLibrary();
      // Length/bitrate can shift by a rounding hair after the remux, and the
      // one-time zones relayout moves every file; refresh only when one of
      // them actually touched the library.
      if (report.remuxed > 0 || (report.relayouted ?? 0) > 0) {
        await queryClient.invalidateQueries({ queryKey: libraryKey });
      }
      return report;
    },
    enabled: library.isSuccess,
    staleTime: Infinity,
    retry: false,
  });
  return null;
}
