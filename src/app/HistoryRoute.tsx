import { useQueryClient } from "@tanstack/react-query";

import { HistoryPage } from "@/features/download/HistoryPage";
import { ImportHistorySection } from "@/features/import/ImportHistorySection";
import { importsKey, useImports } from "@/features/import/hooks";

/**
 * The shell is where the two ways music enters the ark meet: the history page
 * archives both, its one clear button sweeps both, and neither feature may
 * import the other — so counting the imports and dropping their cache after
 * the sweep is wired here.
 */
export function HistoryRoute() {
  const queryClient = useQueryClient();
  const imports = useImports();

  return (
    <HistoryPage
      arrivals={<ImportHistorySection />}
      arrivalsCount={imports.data?.length ?? 0}
      onHistoryCleared={() => queryClient.invalidateQueries({ queryKey: importsKey })}
    />
  );
}
