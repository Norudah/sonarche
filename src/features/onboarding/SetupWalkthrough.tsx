import { useState } from "react";

import type { EnvStatus } from "@/features/onboarding/api";
import type { EntrancePhase } from "@/features/onboarding/entrance";
import { EntranceWelcome } from "@/features/onboarding/EntranceWelcome";
import { SetupLayout } from "@/features/onboarding/layout/SetupLayout";
import { SetupTopBar } from "@/features/onboarding/layout/SetupTopBar";
import { SetupScene } from "@/features/onboarding/scene/SetupScene";
import { sceneState } from "@/features/onboarding/scene/sceneState";
import { EngineScreen } from "@/features/onboarding/screens/EngineScreen";
import { KeyScreen } from "@/features/onboarding/screens/KeyScreen";
import { PythonScreen } from "@/features/onboarding/screens/PythonScreen";
import { initialScreen, nextScreen, previousScreen, screenPosition } from "@/features/onboarding/setupNavigation";
import { buildSetupSteps, type SetupMode, type SetupStepId } from "@/features/onboarding/steps";
import { useEngineInstall } from "@/features/onboarding/useEngineInstall";
import { useKeyFlow } from "@/features/onboarding/useKeyFlow";

/**
 * The setup, for a first run or a repair: one screen per step, the ark beside
 * them. Owns the whole window: the shell is useless until the engine exists.
 */
interface SetupWalkthroughProps {
  mode: SetupMode;
  env: EnvStatus | null;
  acoustidConfigured: boolean;
  onRecheckPython: () => void;
  isCheckingPython: boolean;
  /** The last button: into the app. */
  onEnter: () => void;
  /** Played over the app once `onEnter` was pressed. */
  entrance: EntrancePhase;
}

export function SetupWalkthrough({
  mode,
  env,
  acoustidConfigured,
  onRecheckPython,
  isCheckingPython,
  onEnter,
  entrance,
}: SetupWalkthroughProps) {
  const steps = buildSetupSteps({ env, acoustidConfigured });
  // Session only, like everything here but the key.
  const [screen, setScreen] = useState<SetupStepId>(() => initialScreen(steps));

  const engine = useEngineInstall(Boolean(env?.venvOk && env.depsOk));
  const key = useKeyFlow(acoustidConfigured);

  const scene = sceneState({
    screen,
    engine: engine.status,
    cargo: engine.progress.cargo,
    key: key.view,
    entering: entrance !== "idle",
  });
  const expanded = entrance === "opening" || entrance === "welcome" || entrance === "closing";

  const back = previousScreen(steps, screen);
  const onBack = back ? () => setScreen(back) : null;
  const goNext = () => {
    const next = nextScreen(steps, screen);
    if (next) setScreen(next);
  };

  return (
    <SetupLayout
      scene={
        <SetupScene state={scene} expanded={expanded}>
          <EntranceWelcome mode={mode} visible={entrance === "welcome" || entrance === "closing"} />
        </SetupScene>
      }
      topBar={<SetupTopBar {...screenPosition(steps, screen)} />}
      leaving={entrance !== "idle"}
    >
      {screen === "python" && (
        <PythonScreen
          mode={mode}
          python={env?.python ?? null}
          onRecheck={onRecheckPython}
          isChecking={isCheckingPython}
          onBack={onBack}
          onNext={goNext}
        />
      )}
      {screen === "engine" && (
        <EngineScreen
          mode={mode}
          install={engine}
          libraryDir={env?.libraryDir ?? ""}
          bundled={Boolean(env?.pythonBundled)}
          onBack={onBack}
          onNext={goNext}
          onEnter={onEnter}
        />
      )}
      {screen === "acoustid" && <KeyScreen mode={mode} flow={key} onBack={onBack} onEnter={onEnter} />}
    </SetupLayout>
  );
}
