/** Whether re-match asks for confirmation before rewriting tags. */

import { storedToggle, useStoredToggle } from "@/shared/lib/storedToggle";

const toggle = storedToggle("sonarche.rematchConfirm");

export const readRematchConfirm = toggle.read;
export const storeRematchConfirm = toggle.store;

export function useRematchConfirm(): boolean {
  return useStoredToggle(toggle);
}
