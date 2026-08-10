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

/**
 * How far the import has got. Two stages, because they count different things
 * and a single bar pretending otherwise would stall at 100% for the second.
 */
export type ImportProgress =
  /** beets copying, counted in album folders. */
  | { stage: "copying"; folders: number; folder: string | null }
  /** The cover pass that follows, counted in albums looked at. */
  | { stage: "covers"; done: number; total: number };

/**
 * Follow the import while it runs.
 *
 * The sidecar's events are already forwarded to the webview wholesale, so this
 * listens to them directly rather than having Rust relay the same numbers a
 * second time. Subscribed only while `active`: the import is the one thing on
 * the page, and a listener outliving it would collect the next one's ticks.
 */
export function useImportProgress(active: boolean): ImportProgress | null {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [lastActive, setLastActive] = useState(active);

  // Cleared during render rather than from the effect: an import starting has
  // to forget the last one's ticks *before* anything is drawn, and resetting
  // inside the effect paints one frame of the old numbers first — the previous
  // import's last folder, under the new one's path.
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

/** The archive of finished imports. Never refetched on its own: the only thing
 * that adds a row is an import ending, and that invalidates this key itself. */
export function useImports() {
  return useQuery<ImportRecord[]>({ queryKey: importsKey, queryFn: listImports });
}

/**
 * Run the import. Two caches go stale the moment it ends, and one of them on a
 * failure too: the library gained tracks, and the archive gained a row either
 * way — a failed import is a thing that happened.
 */
export function useLibraryImport() {
  const queryClient = useQueryClient();

  return useMutation<ImportOutcome, unknown, { folder: string; grouping: Grouping; category: string | null }>({
    mutationFn: ({ folder, grouping, category }) => startLibraryImport(folder, grouping, category),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: libraryKey }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: importsKey }),
  });
}

/**
 * What undoing this run would take away, asked only while the question is on
 * screen.
 *
 * A query rather than a call made before opening the dialog: the count comes
 * from a sidecar round-trip over the whole library, and the confirmation should
 * appear at once and fill in, not wait to be shown. Never cached — between two
 * openings the library can have changed, and a stale count under a destructive
 * button is worse than no count.
 */
export function useImportUndoPreview(id: string, enabled: boolean) {
  return useQuery<ImportUndoPreview>({
    queryKey: ["import-undo-preview", id],
    queryFn: () => previewImportUndo(id),
    enabled,
    gcTime: 0,
    staleTime: 0,
  });
}

/**
 * Take one import back out.
 *
 * Everything is invalidated, deliberately. The undo removes tracks, albums,
 * covers and playlist entries in one go — naming the caches it touches would
 * mean this feature reaching into three others, and it is rare enough that
 * refetching the app's state costs nothing anyone will feel.
 */
export function useUndoImport() {
  const queryClient = useQueryClient();

  return useMutation<ImportUndoOutcome, unknown, string>({
    mutationFn: (id) => undoImport(id),
    onSettled: () => queryClient.invalidateQueries(),
  });
}

/**
 * Ask the running import to stop. The signal is the whole call: the import's
 * own mutation is what resolves — with `cancelled` set — once beets has
 * actually stopped, so there is nothing to invalidate here.
 */
export function useCancelImport() {
  return useMutation<void, unknown, void>({ mutationFn: cancelLibraryImport });
}
