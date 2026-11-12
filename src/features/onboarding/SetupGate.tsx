import { Alert } from "@heroui/react";
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { onboardingForcedByDev } from "@/features/onboarding/devOverride";
import { useEntrance } from "@/features/onboarding/entrance";
import { useCompleteOnboarding, useEnvStatus, useOnboardingState } from "@/features/onboarding/hooks";
import { SetupWalkthrough } from "@/features/onboarding/SetupWalkthrough";
import { SplashHandover } from "@/features/onboarding/SplashHandover";
import { useSplashPhase } from "@/features/onboarding/splashPhase";
import { buildSetupSteps, gateState, type SetupMode } from "@/features/onboarding/steps";
import { easings } from "@/shared/motion/tokens";

const DISSOLVE = { duration: 0.7, ease: easings.out };

/** Holds the whole window until setup is done (see `SplashScreen`). Decides
 * which surface owns the window; states come from `steps.ts`. */
export function SetupGate({ children, welcome }: { children: ReactNode; welcome: boolean }) {
  const { t } = useTranslation("onboarding");
  const status = useEnvStatus();
  const onboarding = useOnboardingState();
  const complete = useCompleteOnboarding();
  const reducedMotion = useReducedMotion();

  const steps = buildSetupSteps({
    env: status.data ?? null,
    acoustidConfigured: onboarding.data?.acoustidConfigured ?? false,
  });

  // Fail open: an unreadable flag must not lock users out. A broken environment
  // still holds the gate through the steps.
  const onboardingCompleted = onboardingForcedByDev() ? false : (onboarding.data?.completed ?? true);

  const gate = gateState({ steps, envKnown: status.isSuccess && !onboarding.isPending, onboardingCompleted });
  const { phase, revealed } = useSplashPhase(gate, welcome);

  // Once shown, the setup keeps the window until its last button, even when
  // the environment turns healthy under it (a repair's reinstall). Holds the
  // mode it opened with: completing the setup flips the flag it is read from.
  const openingMode = onboardingCompleted ? "repair" : "firstRun";
  const [held, setHeld] = useState<SetupMode | null>(gate === "onboarding" ? openingMode : null);
  if (gate === "onboarding" && held === null) setHeld(openingMode);

  const entrance = useEntrance({ full: welcome && !reducedMotion, onDone: () => setHeld(null) });
  const entering = entrance.phase !== "idle";
  const dissolving = entrance.phase === "closing" || entrance.phase === "fading";

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

  return (
    <SplashHandover phase={phase} revealed={revealed}>
      {/* Mounted under the setup as soon as the entrance starts, so it is
          painted by the time the setup dissolves. Always wrapped: unwrapping
          at the end would remount the whole app. */}
      {(held === null || entering) && (
        <motion.div
          className="h-full"
          initial={false}
          animate={{ scale: entering && !dissolving ? 0.985 : 1 }}
          transition={DISSOLVE}
        >
          {children}
        </motion.div>
      )}

      {held !== null && (
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={
            dissolving ? { opacity: 0, scale: entrance.phase === "closing" ? 1.03 : 1 } : { opacity: 1, scale: 1 }
          }
          transition={DISSOLVE}
        >
          <SetupWalkthrough
            mode={held}
            env={status.data ?? null}
            acoustidConfigured={onboarding.data?.acoustidConfigured ?? false}
            onRecheckPython={() => status.refetch()}
            isCheckingPython={status.isFetching}
            onEnter={() => {
              complete.mutate();
              entrance.start();
            }}
            entrance={entrance.phase}
          />
        </motion.div>
      )}
    </SplashHandover>
  );
}
