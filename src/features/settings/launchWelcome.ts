/** Whether the splash shows a welcome beat. Only the words are skipped, not the fade. */

import { storedToggle } from "@/shared/lib/storedToggle";

const toggle = storedToggle("sonarche.launchWelcome");

export const readLaunchWelcome = toggle.read;
export const storeLaunchWelcome = toggle.store;
