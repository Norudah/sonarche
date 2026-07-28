/**
 * What the update pane says, given where the two mutations are.
 *
 * Pulled out of the component because it is the part with the rules: five
 * states share one line, they have an order (a failure outranks a result, a
 * result outranks the absence of one), and "not checked yet" and "checked, all
 * good" are different answers that both look like nothing.
 */

export type Tone = "muted" | "success" | "danger";

export interface UpdateState {
  checking: boolean;
  installing: boolean;
  checkFailed: boolean;
  installFailed: boolean;
  /** `undefined` before the first check, `null` when it found nothing, the new
   * version string when it found one. */
  available: string | null | undefined;
}

export interface Status {
  /** Key in the `update` namespace. */
  key: string;
  tone: Tone;
  /** Interpolated into `version`; absent for every other key. */
  version?: string;
}

export function updateStatus(state: UpdateState): Status | null {
  if (state.installFailed) return { key: "failedHint", tone: "danger" };
  if (state.installing) return { key: "installing", tone: "muted" };
  if (state.checkFailed) return { key: "checkFailed", tone: "danger" };
  if (state.checking) return { key: "checking", tone: "muted" };
  if (state.available) return { key: "version", tone: "success", version: state.available };
  // Not `!state.available`: `null` means the check ran, `undefined` means the
  // button has not been pressed yet and the line stays empty.
  if (state.available === null) return { key: "upToDate", tone: "muted" };
  return null;
}
