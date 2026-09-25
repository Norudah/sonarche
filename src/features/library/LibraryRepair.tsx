import { useQuery, useQueryClient } from "@tanstack/react-query";

import { remuxLibrary } from "@/features/library/api";
import { libraryKey, useLibrary } from "@/features/library/hooks";

const repairKey = ["library-repair"] as const;

/** Runs the launch repair pass once the library listing has loaded (proof the
 * sidecar is up). A query, so StrictMode's double mount is deduped; no retry,
 * it runs again next launch. */
export function LibraryRepair() {
  const queryClient = useQueryClient();
  const library = useLibrary();
  useQuery({
    queryKey: repairKey,
    queryFn: async () => {
      const report = await remuxLibrary();
      // Refresh only if the pass changed something.
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
