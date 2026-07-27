import { useMutation, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import { type ImportOutcome, startLibraryImport } from "@/features/import/api";
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

/** Run the import. The library listing is stale the moment it succeeds. */
export function useLibraryImport() {
  const queryClient = useQueryClient();

  return useMutation<ImportOutcome, unknown, string>({
    mutationFn: startLibraryImport,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: libraryKey }),
  });
}
