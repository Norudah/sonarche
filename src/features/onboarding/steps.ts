/** The setup walkthrough as data: every part of the UI reads this one list. */

import type { EnvStatus } from "@/features/onboarding/api";

/** Ordered by dependency: interpreter, then engine, then the key. */
export const SETUP_STEP_IDS = ["python", "engine", "acoustid"] as const;

export type SetupStepId = (typeof SETUP_STEP_IDS)[number];

export type SetupStepState =
  | "satisfied"
  /** The current step. */
  | "actionRequired"
  /** Blocked by an earlier blocking step. */
  | "pending"
  /** Optional, passed over. */
  | "skipped";

export interface SetupStep {
  id: SetupStepId;
  state: SetupStepState;
  /** Must be satisfied before the app can open. */
  blocking: boolean;
}

interface SetupInput {
  /** `null` while the check is in flight. */
  env: EnvStatus | null;
  acoustidConfigured: boolean;
  /** Session only, never persisted. */
  skipped?: readonly SetupStepId[];
}

const BLOCKING: Record<SetupStepId, boolean> = {
  python: true,
  engine: true,
  // Recommended, not required: without a key tags are guessed.
  acoustid: false,
};

function isSatisfied(id: SetupStepId, input: SetupInput): boolean {
  const env = input.env;
  if (!env) return false;
  switch (id) {
    case "python":
      return env.python !== null;
    case "engine":
      return env.venvOk && env.depsOk;
    case "acoustid":
      return input.acoustidConfigured;
  }
}

/** `pending` propagates from the first unsatisfied blocking step; optional
 * steps never block. */
export function buildSetupSteps(input: SetupInput): SetupStep[] {
  const skipped = new Set(input.skipped ?? []);
  let blocked = false;

  // A bundled interpreter removes the Python step entirely.
  const ids = SETUP_STEP_IDS.filter((id) => id !== "python" || !input.env?.pythonBundled);

  return ids.map((id) => {
    const blocking = BLOCKING[id];
    const satisfied = isSatisfied(id, input);
    let state: SetupStepState;

    if (satisfied) state = "satisfied";
    else if (blocked) state = "pending";
    else if (skipped.has(id)) state = "skipped";
    else state = "actionRequired";

    if (blocking && !satisfied) blocked = true;
    return { id, state, blocking };
  });
}

export function canFinishSetup(steps: readonly SetupStep[]): boolean {
  return steps.every((step) => !step.blocking || step.state === "satisfied");
}

export type GateState =
  /** Show the splash. */
  "checking" | "onboarding" | "ready";

/** Holds the window if the environment is unusable or the walkthrough was
 * never completed (hence the persisted flag, see `preferences.rs`). */
export function gateState(input: {
  steps: readonly SetupStep[];
  envKnown: boolean;
  onboardingCompleted: boolean;
}): GateState {
  if (!input.envKnown) return "checking";
  if (!canFinishSetup(input.steps)) return "onboarding";
  return input.onboardingCompleted ? "ready" : "onboarding";
}

/** Same steps either way; the wording differs for returning users. */
export type SetupMode =
  | "firstRun"
  /** The environment broke after a completed setup. */
  | "repair";
