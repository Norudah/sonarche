import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import {
  cancelLibraryImport,
  type ImportOutcome,
  type ImportRecord,
  type ImportUndoOutcome,
  type ImportUndoPreview,
  listImports,
  previewImportUndo,
  startLibraryImport,
  undoImport,
  type Grouping,
} from "@/features/import/api";
import { libraryKey } from "@/features/library/hooks";

/** Two stages counting different things. */
export type ImportProgress =
  /** Album folders copied by beets. */
  | { stage: "copying"; folders: number; folder: string | null }
  /** Albums checked by the cover pass. */
  | { stage: "covers"; done: number; total: number };

/** Follows the sidecar's forwarded progress events while `active`. */
export function useImportProgress(active: boolean): ImportProgress | null {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [lastActive, setLastActive] = useState(active);

  // Reset during render, so the previous import's numbers never paint.
  if (lastActive !== active) {
    setLastActive(active);
    setProgress(null);
  }

  useEffect(() => {
    if (!active) return;
    const unlisten = listen<{ event: string; data: Record<string, unknown> }>("sidecar:event", (event) => {
      const { event: name, data } = event.payload;
      if (name === "library_import_progress") {
        setProgress({
          stage: "copying",
          folders: Number(data.folders ?? 0),
          folder: typeof data.folder === "string" ? data.folder : null,
        });
      } else if (name === "library_covers_progress") {
        setProgress({ stage: "covers", done: Number(data.done ?? 0), total: Number(data.total ?? 0) });
      }
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [active]);

  return progress;
}

export const importsKey = ["imports"] as const;

/** Only invalidated when an import ends. */
export function useImports() {
  return useQuery<ImportRecord[]>({ queryKey: importsKey, queryFn: listImports });
}

/** Lets the shell find the running import in the mutation cache (for the toast). */
export const importRunKey = ["library-import-run"] as const;

/** Invalidates the library and the archive; a failed import is archived too. */
export function useLibraryImport() {
  const queryClient = useQueryClient();

  return useMutation<ImportOutcome, unknown, { folder: string; grouping: Grouping; category: string | null }>({
    mutationKey: importRunKey,
    mutationFn: ({ folder, grouping, category }) => startLibraryImport(folder, grouping, category),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: libraryKey }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: importsKey }),
  });
}

/** Fetched only while the confirmation is open, never cached. */
export function useImportUndoPreview(id: string, enabled: boolean) {
  return useQuery<ImportUndoPreview>({
    queryKey: ["import-undo-preview", id],
    queryFn: () => previewImportUndo(id),
    enabled,
    gcTime: 0,
    staleTime: 0,
  });
}

/** Invalidates everything: tracks, albums, covers and playlists all change. */
export function useUndoImport() {
  const queryClient = useQueryClient();

  return useMutation<ImportUndoOutcome, unknown, string>({
    mutationFn: (id) => undoImport(id),
    onSettled: () => queryClient.invalidateQueries(),
  });
}

/** Only signals; the import mutation resolves as cancelled. */
export function useCancelImport() {
  return useMutation<void, unknown, void>({ mutationFn: cancelLibraryImport });
}
