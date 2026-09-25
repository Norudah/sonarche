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
import { buildSetupSteps, canFinishSetup, type SetupMode, type SetupStepId } from "@/features/onboarding/steps";
import { LanguageChoice } from "@/shared/i18n/LanguageChoice";
import { fade, springs } from "@/shared/motion/tokens";
import { WindowDragStrip } from "@/shared/ui/WindowDragStrip";

/**
 * The setup walkthrough, for a first run or a repair (only the header and
 * closing line differ). Owns the whole window: the shell is useless until the
 * engine exists. Steps are ordered by dependency.
 */
export interface SetupWalkthroughProps {
  mode: SetupMode;
  env: EnvStatus | null;
  acoustidConfigured: boolean;
  onRecheckPython: () => void;
  isCheckingPython: boolean;
  onFinish: () => void;
  isFinishing: boolean;
}

export function SetupWalkthrough({
  mode,
  env,
  acoustidConfigured,
  onRecheckPython,
  isCheckingPython,
  onFinish,
  isFinishing,
}: SetupWalkthroughProps) {
  const { t } = useTranslation("onboarding");
  const { t: tCommon } = useTranslation("common");
  // Session only.
  const [skipped, setSkipped] = useState<SetupStepId[]>([]);

  const steps = buildSetupSteps({ env, acoustidConfigured, skipped });
  const canFinish = canFinishSetup(steps);

  const panels: Record<SetupStepId, React.ReactNode> = {
    python: <PythonPanel python={env?.python ?? null} onRecheck={onRecheckPython} isChecking={isCheckingPython} />,
    engine: (
      <EnginePanel
        mode={mode}
        isInstalled={Boolean(env?.venvOk && env.depsOk)}
        isBundled={Boolean(env?.pythonBundled)}
      />
    ),
    acoustid: (
      <AcoustidPanel isConfigured={acoustidConfigured} onSkip={() => setSkipped((prev) => [...prev, "acoustid"])} />
    ),
  };

  /** Per-step status column; steps still out of reach say nothing. */
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
    // The only nudge: an open optional step.
    return step.blocking ? null : <StepSummary tone="warning">{t(`steps.${step.id}.recommended`)}</StepSummary>;
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="relative min-h-full">
        <WindowDragStrip />

        {/* Same wash as the rest of the app. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 hero-wash" />

        <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-9 px-8 pt-20 pb-16">
          <header className="flex items-start justify-between gap-8">
            <div className="min-w-0">
              <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">
                {t(`walkthrough.${mode}.eyebrow`)}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">
                {t(`walkthrough.${mode}.title`)}
              </h1>
              <p className="mt-2.5 max-w-prose text-[0.9375rem] leading-relaxed text-muted">
                {t(`walkthrough.${mode}.lead`)}
              </p>
            </div>
            {/* Language choice on the first screen, before anything must be read. */}
            <div className="w-40 shrink-0">
              <LanguageChoice label={t("walkthrough.language")} />
            </div>
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

          {/* Appears once everything is done. */}
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
                    {t(`walkthrough.${mode}.enter`, { app: tCommon("appName") })}
                    <ArrowRight className="size-4" />
                  </Button>
                  {env?.libraryDir && (
                    <p className="min-w-0 flex-1 truncate text-xs text-muted" title={env.libraryDir}>
                      {t(`walkthrough.${mode}.libraryHint`, { path: env.libraryDir })}
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
