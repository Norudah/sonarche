/** Whether the download and import option panels open by themselves. On by
 * default (so new users discover the options), switchable per panel. */

import { storedToggle, useStoredToggle, type StoredToggle } from "@/shared/lib/storedToggle";

type OptionPanel = "download" | "import";

const toggles: Record<OptionPanel, StoredToggle> = {
  download: storedToggle("sonarche.autoExpand.download"),
  import: storedToggle("sonarche.autoExpand.import"),
};

export function storeAutoExpand(panel: OptionPanel, enabled: boolean): void {
  toggles[panel].store(enabled);
}

export function useAutoExpand(panel: OptionPanel): boolean {
  return useStoredToggle(toggles[panel]);
}
