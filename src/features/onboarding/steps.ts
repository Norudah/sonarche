/**
 * The first-run walkthrough as data, not as a tree of conditionals.
 *
 * Every screen the walkthrough draws — the checklist, the active panel, the
 * "can I finish" button — reads this one list. That is what lets a step change
 * nature without a redesign: the day Python ships inside the bundle, its step
 * is simply always `satisfied`, collapses into a line like any other, and no
 * component has to know it used to be the hard one.
 */

import type { EnvStatus } from "@/features/onboarding/api";

/** Ordered: the walkthrough renders them in exactly this sequence. */
export const SETUP_STEP_IDS = ["python", "engine", "acoustid", "library"] as const;

export type SetupStepId = (typeof SETUP_STEP_IDS)[number];

export type SetupStepState =
  /** Done — collapses into a satisfied line. */
  | "satisfied"
  /** The one the user is on. */
  | "actionRequired"
  /** Not reachable yet: an earlier blocking step is still open. */
  | "pending"
  /** Optional, and passed over on purpose. */
  | "skipped";

export interface SetupStep {
  id: SetupStepId;
  state: SetupStepState;
  /** A blocking step must be satisfied before the app can open at all. */
  blocking: boolean;
}

export interface SetupInput {
  /** `null` while the environment check is still in flight. */
  env: EnvStatus | null;
  acoustidConfigured: boolean;
  /** Optional steps the user passed over. In-session only — never persisted. */
  skipped?: readonly SetupStepId[];
}

const BLOCKING: Record<SetupStepId, boolean> = {
  python: true,
  engine: true,
  // Strongly pushed, never enforced: without a key the app still runs, it just
  // guesses tags instead of identifying them.
  acoustid: false,
  library: false,
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
    case "library":
      // The directory is created as a side effect of a healthy environment, so
      // this step is a statement of where the music lands, not a task.
      return env.venvOk && env.depsOk;
  }
}

/**
 * The steps in order, each carrying its own state.
 *
 * `pending` propagates forward from the first unsatisfied *blocking* step: an
 * optional step left open never holds up the ones behind it, which is what
 * makes "skip the key, finish anyway" possible.
 */
export function buildSetupSteps(input: SetupInput): SetupStep[] {
  const skipped = new Set(input.skipped ?? []);
  let blocked = false;

  return SETUP_STEP_IDS.map((id) => {
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

/** Whether the walkthrough may be finished — optional steps do not count. */
export function canFinishSetup(steps: readonly SetupStep[]): boolean {
  return steps.every((step) => !step.blocking || step.state === "satisfied");
}

export type GateState =
  /** Nothing is known yet; show the splash, not the walkthrough. */
  | "checking"
  /** The walkthrough owns the window. */
  | "onboarding"
  /** The app may render. */
  | "ready";

/**
 * Two different reasons to hold the window, deliberately collapsed into one
 * state: the environment is unusable, *or* it is usable but the user has never
 * been walked through it. The second is why the flag has to be persisted —
 * see `preferences.rs`.
 */
export function gateState(input: {
  steps: readonly SetupStep[];
  envKnown: boolean;
  onboardingCompleted: boolean;
}): GateState {
  if (!input.envKnown) return "checking";
  if (!canFinishSetup(input.steps)) return "onboarding";
  return input.onboardingCompleted ? "ready" : "onboarding";
}
