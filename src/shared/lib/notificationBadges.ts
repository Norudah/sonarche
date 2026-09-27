/** Whether the sidebar shows notification badges (the Metadata to-fix count). */

import { storedToggle, useStoredToggle } from "@/shared/lib/storedToggle";

const toggle = storedToggle("sonarche.notificationBadges");

export const readNotificationBadges = toggle.read;
export const storeNotificationBadges = toggle.store;

export function useNotificationBadges(): boolean {
  return useStoredToggle(toggle);
}
