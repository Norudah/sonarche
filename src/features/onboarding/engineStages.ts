/** The engine install as three stages the user can read, each one a phase
 * `setup_env` really goes through: venv, pip, then the beets config. */

import { installPhase, namedPackageCount } from "@/features/onboarding/installPhase";

export type EngineStatus = "idle" | "installing" | "done" | "error";

export const ENGINE_STAGES = ["venv", "packages", "finalize"] as const;

/** What the line under the card says while the install runs. */
type LiveLine = { kind: "venv" } | { kind: "package"; pkg: string } | { kind: "packages" } | { kind: "finalizing" };

export interface EngineProgress {
  /** Stages behind the user, 0 to 3. */
  cleared: number;
  /** The stage running or that failed; `null` when idle or done. */
  current: number | null;
  /** Crates aboard the ark in the scene, 0 to 4. */
  cargo: number;
  live: LiveLine | null;
}

/** Stage 2 loads one crate per package pip names, up to the third. */
const PACKAGE_CARGO_MAX = 3;
/** A failed install leaves the third crate on the quay. */
const STRANDED_CARGO_MAX = 2;

export function engineProgress(status: EngineStatus, logs: readonly string[]): EngineProgress {
  if (status === "idle") return { cleared: 0, current: null, cargo: 0, live: null };
  if (status === "done") return { cleared: ENGINE_STAGES.length, current: null, cargo: 4, live: null };

  const phase = installPhase(logs);
  let stage: number;
  let cargo: number;
  let live: LiveLine;

  switch (phase.kind) {
    case "starting":
    case "venv":
      stage = 0;
      cargo = 0;
      live = { kind: "venv" };
      break;
    case "fetching":
    case "installing":
      stage = 1;
      cargo = Math.min(PACKAGE_CARGO_MAX, Math.max(1, namedPackageCount(logs)));
      live = phase.kind === "fetching" ? { kind: "package", pkg: phase.pkg } : { kind: "packages" };
      break;
    case "finalizing":
    case "done":
      stage = 2;
      cargo = PACKAGE_CARGO_MAX;
      live = { kind: "finalizing" };
      break;
  }

  if (status === "error") {
    return { cleared: stage, current: stage, cargo: Math.min(cargo, STRANDED_CARGO_MAX), live: null };
  }
  return { cleared: stage, current: stage, cargo, live };
}
