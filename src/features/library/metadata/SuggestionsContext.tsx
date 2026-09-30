import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useLibrary } from "@/features/library/hooks";
import { buildSuggestionPools, type SuggestionPools, type SuggestKind, type Suggestion } from "./suggestions";

/** Suggestion pools computed once per editing surface. Without a provider,
 * inputs are plain text fields. */

const SuggestionsContext = createContext<SuggestionPools | null>(null);

export function MetadataSuggestionsProvider({ children }: { children: ReactNode }) {
  const { data } = useLibrary();
  const pools = useMemo(() => buildSuggestionPools(data ?? []), [data]);
  return <SuggestionsContext.Provider value={pools}>{children}</SuggestionsContext.Provider>;
}

export function useSuggestionPool(kind: SuggestKind | undefined): Suggestion[] | null {
  const pools = useContext(SuggestionsContext);
  if (!kind || !pools) return null;
  return pools[kind];
}
