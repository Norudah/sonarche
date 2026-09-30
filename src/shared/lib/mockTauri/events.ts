/** Event plumbing: Tauri's `listen()` registers a callback id that the
 * backend calls; the player depends on these pushed events. */

/** Event listeners by name. Tauri's `listen()` registers a callback id that
 * the backend calls; the player depends on these pushed events. */
export const listeners = new Map<string, Set<(payload: unknown) => void>>();

export function emitMockEvent(event: string, payload: unknown) {
  for (const handler of listeners.get(event) ?? []) handler(payload);
}
