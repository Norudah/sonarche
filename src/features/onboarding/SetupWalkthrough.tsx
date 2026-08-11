import { Button } from "@heroui/react";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { EnvStatus } from "@/features/onboarding/api";
import { AcoustidPanel } from "@/features/onboarding/panels/AcoustidPanel";
import { EnginePanel } from "@/features/onboarding/panels/EnginePanel";
import { PythonPanel } from "@/features/onboarding/panels/PythonPanel";
import { StepRow, StepSummary } from "@/features/onboarding/StepRow";
import { buildSetupSteps, canFinishSetup, type SetupStepId } from "@/features/onboarding/steps";
import { fade, springs } from "@/shared/motion/tokens";
import { WindowDragStrip } from "@/shared/ui/WindowDragStrip";

/**
 * The first thing anyone sees.
 *
 * It owns the whole window rather than sitting in the shell — the sidebar leads
 * nowhere until the engine exists, and a half-live chrome reads as an app
 * ignoring you (see `SplashScreen` for where that lesson came from).
 *
 * The structure is a rail with numbered stations, and the numbering is earned:
 * nothing installs before an interpreter is found, and nothing is fingerprinted
 * before the engine exists. Where the music lands is stated at the end as a
 * fact, not dressed up as a fourth task.
 */
export interface SetupWalkthroughProps {
  env: EnvStatus | null;
  acoustidConfigured: boolean;
  onRecheckPython: () => void;
  isCheckingPython: boolean;
  onFinish: () => void;
  isFinishing: boolean;
}

export function SetupWalkthrough({
  env,
  acoustidConfigured,
  onRecheckPython,
  isCheckingPython,
  onFinish,
  isFinishing,
}: SetupWalkthroughProps) {
  const { t } = useTranslation("onboarding");
  const { t: tCommon } = useTranslation("common");
  // In-session only: passing over the key is a decision about this screen, not
  // a preference worth carrying to the next launch.
  const [skipped, setSkipped] = useState<SetupStepId[]>([]);

  const steps = buildSetupSteps({ env, acoustidConfigured, skipped });
  const canFinish = canFinishSetup(steps);

  const panels: Record<SetupStepId, React.ReactNode> = {
    python: <PythonPanel python={env?.python ?? null} onRecheck={onRecheckPython} isChecking={isCheckingPython} />,
    engine: <EnginePanel isInstalled={Boolean(env?.venvOk && env.depsOk)} isBundled={Boolean(env?.pythonBundled)} />,
    acoustid: (
      <AcoustidPanel isConfigured={acoustidConfigured} onSkip={() => setSkipped((prev) => [...prev, "acoustid"])} />
    ),
  };

  /**
   * The right-hand column, per step. Driven by the step's own state rather than
   * by the raw environment, so a step still out of reach says nothing at all —
   * an amber "strongly recommended" against a greyed-out step three rungs down
   * is a nag about something the user cannot act on yet.
   */
  const summaryFor = (step: (typeof steps)[number]): React.ReactNode => {
    if (step.state === "pending") return null;
    if (step.state === "skipped") return <StepSummary tone="muted">{t(`steps.${step.id}.skipped`)}</StepSummary>;
    if (step.state === "satisfied") {
      return (
        <StepSummary tone="success">
          {step.id === "python"
            ? t("steps.python.done", { version: env?.python?.version })
            : t(`steps.${step.id}.done`)}
        </StepSummary>
      );
    }
    // Open, and optional: the only place the walkthrough leans on the user.
    return step.blocking ? null : <StepSummary tone="warning">{t(`steps.${step.id}.recommended`)}</StepSummary>;
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="relative min-h-full">
        <WindowDragStrip />

        {/* The same accent wash the download composer and every library hero sit
            on, so the first screen already belongs to the app it opens. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 hero-wash" />

        <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-9 px-8 pt-20 pb-16">
          <header>
            <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">
              {t("walkthrough.eyebrow")}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">{t("walkthrough.title")}</h1>
            <p className="mt-2.5 max-w-prose text-[0.9375rem] leading-relaxed text-muted">{t("walkthrough.lead")}</p>
          </header>

          <ol className="flex flex-col">
            {steps.map((step, index) => (
              <StepRow
                key={step.id}
                index={index + 1}
                step={step}
                isLast={index === steps.length - 1}
                title={t(`steps.${step.id}.title`)}
                summary={summaryFor(step)}
              >
                {panels[step.id]}
              </StepRow>
            ))}
          </ol>

          {/* Appears only once the way is clear — a button that shows up is the
              signal that the list is done, where a disabled one from the start
              is just furniture. */}
          <AnimatePresence initial={false}>
            {canFinish && (
              <motion.footer
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ ...springs.soft, opacity: fade }}
                className="flex flex-col gap-3 border-t border-separator pt-6"
              >
                <div className="flex items-center gap-4">
                  <Button variant="primary" onPress={onFinish} isDisabled={isFinishing} className="px-5">
                    {t("walkthrough.enter", { app: tCommon("appName") })}
                    <ArrowRight className="size-4" />
                  </Button>
                  {env?.libraryDir && (
                    <p className="min-w-0 flex-1 truncate text-xs text-muted" title={env.libraryDir}>
                      {t("walkthrough.libraryHint", { path: env.libraryDir })}
                    </p>
                  )}
                </div>
              </motion.footer>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
