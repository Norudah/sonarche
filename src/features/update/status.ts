/** The update pane's status line, ordered: failure > result > nothing. */

export type Tone = "muted" | "success" | "danger";

export interface UpdateState {
  checking: boolean;
  installing: boolean;
  checkFailed: boolean;
  installFailed: boolean;
  /** `undefined` before the first check, `null` when nothing was found. */
  available: string | null | undefined;
}

interface Status {
  key: string;
  tone: Tone;
  version?: string;
}

export function updateStatus(state: UpdateState): Status | null {
  if (state.installFailed) return { key: "failedHint", tone: "danger" };
  if (state.installing) return { key: "installing", tone: "muted" };
  if (state.checkFailed) return { key: "checkFailed", tone: "danger" };
  if (state.checking) return { key: "checking", tone: "muted" };
  if (state.available) return { key: "version", tone: "success", version: state.available };
  // `null`: checked. `undefined`: not checked yet, so nothing is shown.
  if (state.available === null) return { key: "upToDate", tone: "muted" };
  return null;
}
