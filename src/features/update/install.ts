import { relaunch } from "@tauri-apps/plugin-process";
import type { check } from "@tauri-apps/plugin-updater";

export type Update = NonNullable<Awaited<ReturnType<typeof check>>>;

/**
 * Download the new bundle, swap it in, restart.
 *
 * The relaunch is not a courtesy: once `downloadAndInstall` returns, the new
 * version is on disk and the process still running is the old one. Skipping it
 * leaves the app in a state where the version it reports and the version it is
 * disagree until the user quits on their own.
 *
 * Shared by the launch toast and the Settings pane — two ways into the same
 * install, and this half must not drift between them.
 */
export async function installUpdate(update: Update): Promise<void> {
  await update.downloadAndInstall();
  await relaunch();
}
