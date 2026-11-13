import { engineProgress, type EngineStatus } from "@/features/onboarding/engineStages";
import { useSetupEnv, useSetupLogs } from "@/features/onboarding/hooks";

/** The engine install, held above the screens so its log survives going
 * back and forth between them. */
export function useEngineInstall(installed: boolean) {
  const setup = useSetupEnv();
  const logs = useSetupLogs(setup.isPending);

  let status: EngineStatus = installed ? "done" : "idle";
  if (setup.isPending) status = "installing";
  else if (setup.isError) status = "error";

  return {
    status,
    progress: engineProgress(status, logs),
    logs,
    error: setup.isError ? String(setup.error) : null,
    install: () => setup.mutate(),
  };
}

export type EngineInstall = ReturnType<typeof useEngineInstall>;
