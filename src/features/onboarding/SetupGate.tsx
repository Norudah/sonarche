import { Alert } from "@heroui/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { onboardingForcedByDev } from "@/features/onboarding/devOverride";
import { useCompleteOnboarding, useEnvStatus, useOnboardingState } from "@/features/onboarding/hooks";
import { SetupWalkthrough } from "@/features/onboarding/SetupWalkthrough";
import { SplashHandover } from "@/features/onboarding/SplashHandover";
import { useSplashPhase } from "@/features/onboarding/splashPhase";
import { buildSetupSteps, gateState } from "@/features/onboarding/steps";

/** Holds the whole window until setup is done (see `SplashScreen`). Decides
 * which surface owns the window; states come from `steps.ts`. */
export function SetupGate({ children, welcome }: { children: ReactNode; welcome: boolean }) {
  const { t } = useTranslation("onboarding");
  const status = useEnvStatus();
  const onboarding = useOnboardingState();
  const complete = useCompleteOnboarding();

  const steps = buildSetupSteps({
    env: status.data ?? null,
    acoustidConfigured: onboarding.data?.acoustidConfigured ?? false,
  });

  // Fail open: an unreadable flag must not lock users out. A broken environment
  // still holds the gate through the steps.
  const onboardingCompleted = onboardingForcedByDev() ? false : (onboarding.data?.completed ?? true);

  const gate = gateState({ steps, envKnown: status.isSuccess && !onboarding.isPending, onboardingCompleted });

  const { phase, revealed } = useSplashPhase(gate, welcome);

  if (status.isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <Alert status="danger" className="max-w-lg">
          <Alert.Content>
            <Alert.Title>{t("statusError")}</Alert.Title>
            <Alert.Description>{String(status.error)}</Alert.Description>
          </Alert.Content>
        </Alert>
      </div>
    );
  }

  // Keep the walkthrough mounted under the "aboard" beat, so the shell doesn't flash.
  const walkthroughHoldsTheGround = gate === "onboarding" || phase === "aboard";

  return (
    <SplashHandover phase={phase} revealed={revealed}>
      {walkthroughHoldsTheGround ? (
        <SetupWalkthrough
          // The gate found the environment unusable: a completed flag means it broke later.
          mode={onboardingCompleted ? "repair" : "firstRun"}
          env={status.data ?? null}
          acoustidConfigured={onboarding.data?.acoustidConfigured ?? false}
          onRecheckPython={() => status.refetch()}
          isCheckingPython={status.isFetching}
          onFinish={() => complete.mutate()}
          isFinishing={complete.isPending}
        />
      ) : (
        children
      )}
    </SplashHandover>
  );
}
