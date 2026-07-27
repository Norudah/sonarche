import { Alert } from "@heroui/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { onboardingForcedByDev } from "@/features/onboarding/devOverride";
import { useCompleteOnboarding, useEnvStatus, useOnboardingState } from "@/features/onboarding/hooks";
import { SetupFlow } from "@/features/onboarding/SetupFlow";
import { SplashScreen } from "@/features/onboarding/SplashScreen";
import { buildSetupSteps, gateState } from "@/features/onboarding/steps";

/**
 * Nothing downstream renders until the walkthrough is done with the window.
 * Wraps the whole shell, not just the routed content: see `SplashScreen` for
 * why a half-interactive sidebar was worse than a full-window wait.
 *
 * The gate only decides *which* of three surfaces owns the window; the states
 * themselves are computed in `steps.ts` and drawn in `SetupFlow`.
 */
export function SetupGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation("onboarding");
  const status = useEnvStatus();
  const onboarding = useOnboardingState();
  const complete = useCompleteOnboarding();

  const steps = buildSetupSteps({
    env: status.data ?? null,
    acoustidConfigured: onboarding.data?.acoustidConfigured ?? false,
  });

  const gate = gateState({
    steps,
    envKnown: status.isSuccess && !onboarding.isPending,
    // Fail open: a walkthrough flag we cannot read must not lock anyone out of
    // their own library. A genuinely broken environment still holds the window,
    // because that verdict comes from the steps, not from this flag.
    onboardingCompleted: onboardingForcedByDev() ? false : (onboarding.data?.completed ?? true),
  });

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

  if (gate === "checking") return <SplashScreen />;

  if (gate === "onboarding") {
    return (
      <SetupFlow
        steps={steps}
        onRetryPython={() => status.refetch()}
        isCheckingPython={status.isFetching}
        onFinish={() => complete.mutate()}
        isFinishing={complete.isPending}
      />
    );
  }

  return <>{children}</>;
}
