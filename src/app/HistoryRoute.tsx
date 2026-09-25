import { useQueryClient } from "@tanstack/react-query";

import { HistoryPage } from "@/features/download/HistoryPage";
import { ImportHistorySection } from "@/features/import/ImportHistorySection";
import { importsKey, useImports } from "@/features/import/hooks";

/** Composed in the shell because the history covers both downloads and imports, and features can't import each other. */
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
