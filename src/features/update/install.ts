import { relaunch } from "@tauri-apps/plugin-process";
import type { check } from "@tauri-apps/plugin-updater";

export type Update = NonNullable<Awaited<ReturnType<typeof check>>>;

/** Downloads, installs and relaunches; the running process is the old version
 * until then. */
export async function installUpdate(update: Update): Promise<void> {
  await update.downloadAndInstall();
  await relaunch();
}
