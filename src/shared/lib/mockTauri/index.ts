/** Dev-only Tauri IPC stub so the UI can be previewed in a plain browser
 * (`vite dev` + `?mockTauri`). Never bundled in production builds. */

import { handlers as covers } from "./covers";
import { handlers as downloads, tickDownloadProgress } from "./downloads";
import { listeners } from "./events";
import { handlers as imports } from "./imports";
import { handlers as library } from "./library";
import { handlers as player, mockPlayback } from "./player";
import { handlers as playlists } from "./playlists";
import { handlers as setup } from "./setup";
import type { Handler } from "./types";

const handlers: Record<string, Handler> = {
  ...covers,
  ...downloads,
  ...imports,
  ...library,
  ...player,
  ...playlists,
  ...setup,
};

let callbackId = 0;
const callbacks = new Map<number, (message: unknown) => void>();

export function installMockTauri() {
  tickDownloadProgress();
  // @tauri-apps/api v2 routes `unlisten` through this object.
  (window as unknown as Record<string, unknown>).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: () => {},
  };
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
    transformCallback: (callback: (message: unknown) => void) => {
      const id = ++callbackId;
      callbacks.set(id, callback);
      return id;
    },
    convertFileSrc: (path: string) => path,
    invoke: async (cmd: string, payload?: Record<string, unknown>) => {
      if (cmd === "plugin:event|listen") {
        const event = String(payload?.event);
        const callback = callbacks.get(Number(payload?.handler));
        if (callback) {
          const deliver = (value: unknown) => callback({ event, id: callbackId, payload: value });
          const set = listeners.get(event) ?? new Set();
          set.add(deliver);
          listeners.set(event, set);
        }
        return callbackId;
      }
      const handler = handlers[cmd];
      if (handler) return handler(payload);
      if (cmd.startsWith("plugin:event|")) return ++callbackId;
      if (cmd.startsWith("plugin:opener|")) return null;
      if (cmd.startsWith("plugin:updater|") || cmd.startsWith("plugin:process|")) return null;
      // Fake playhead: the Rust engine owns playback.
      if (cmd.startsWith("player_") || cmd === "now_playing_set") return mockPlayback(cmd, payload);
      return {};
    },
  };
}
