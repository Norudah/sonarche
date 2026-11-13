/** What the ark illustration shows for the screen in front of it. The scene
 * mirrors the setup; it never has controls of its own. */

import type { EngineStatus } from "@/features/onboarding/engineStages";
import type { KeyView } from "@/features/onboarding/keyView";
import type { SetupStepId } from "@/features/onboarding/steps";

type SceneLabel = "waiting" | "installing" | "ready" | "interrupted" | "identifying" | "verifying";

type SceneCaption =
  | "waiting"
  | "loading"
  | "afloat"
  | "stranded"
  | "guessing"
  | "learning"
  | "verifying"
  | "listening"
  | "stillListening"
  | "unknownKey";

export interface SceneState {
  /** At sea and bobbing, rather than on its dry-dock cradles. */
  afloat: boolean;
  /** Crates aboard, 0 to 4; the others are drawn as dashed outlines. */
  cargo: number;
  /** One crate left on the quay, after a failed install. */
  stranded: boolean;
  onde: "rest" | "work" | "live";
  rings: "none" | "slow" | "fast";
  glow: "low" | "mid" | "full";
  label: SceneLabel;
  caption: SceneCaption;
  /** The label's dot pulses while something runs. */
  busy: boolean;
}

interface SceneInput {
  screen: SetupStepId;
  engine: EngineStatus;
  /** From `engineProgress`. */
  cargo: number;
  key: KeyView;
  /** The entrance into the app is playing. */
  entering: boolean;
}

const DOCK = { afloat: false, stranded: false, onde: "rest", rings: "none", glow: "low", busy: false } as const;
const SEA = { afloat: true, cargo: 4, stranded: false, onde: "live", glow: "full", busy: false } as const;

const KEY_SCENES: Record<KeyView, Pick<SceneState, "rings" | "label" | "caption" | "busy">> = {
  intro: { rings: "none", label: "identifying", caption: "guessing", busy: false },
  steps: { rings: "slow", label: "identifying", caption: "learning", busy: false },
  verifying: { rings: "fast", label: "verifying", caption: "verifying", busy: true },
  rejected: { rings: "none", label: "identifying", caption: "unknownKey", busy: false },
  verified: { rings: "slow", label: "ready", caption: "listening", busy: false },
  saved: { rings: "slow", label: "ready", caption: "stillListening", busy: false },
};

export function sceneState({ screen, engine, cargo, key, entering }: SceneInput): SceneState {
  if (entering) return { ...SEA, rings: "slow", label: "ready", caption: "afloat" };

  if (screen === "acoustid") return { ...SEA, ...KEY_SCENES[key] };

  // The Python screen comes before any install: an empty dock.
  if (screen === "python" || engine === "idle") {
    return { ...DOCK, cargo: 0, label: "waiting", caption: "waiting" };
  }

  switch (engine) {
    case "installing":
      return { ...DOCK, cargo, onde: "work", glow: "mid", label: "installing", caption: "loading", busy: true };
    case "error":
      return { ...DOCK, cargo, stranded: true, label: "interrupted", caption: "stranded" };
    case "done":
      return { ...SEA, rings: "none", label: "ready", caption: "afloat" };
  }
}
