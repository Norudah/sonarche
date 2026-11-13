/** What the AcoustID key screen shows, from the save mutation and the
 * screen's own session state. */

export type KeyView =
  | "intro"
  /** The three steps, field open. */
  | "steps"
  | "verifying"
  /** AcoustID turned the key down. */
  | "rejected"
  /** Saved during this session. */
  | "verified"
  /** Already stored before this screen opened. */
  | "saved";

interface KeyViewInput {
  page: "intro" | "steps";
  configured: boolean;
  /** "Change key" was pressed on a stored key. */
  changing: boolean;
  saving: boolean;
  rejected: boolean;
  justSaved: boolean;
}

export function keyView(input: KeyViewInput): KeyView {
  if (input.saving) return "verifying";
  if (input.justSaved) return "verified";
  if (input.rejected) return "rejected";
  if (input.configured && !input.changing) return "saved";
  return input.page;
}
