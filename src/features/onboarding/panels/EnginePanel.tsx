import { Alert, Button } from "@heroui/react";
import { ChevronDown, Download } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSetupEnv, useSetupLogs } from "@/features/onboarding/hooks";
import { installPhase } from "@/features/onboarding/installPhase";
import { springs } from "@/shared/motion/tokens";
import { Swap } from "@/shared/motion/Swap";

/**
 * The long one — minutes of network, and the only place in the walkthrough with
 * work to watch.
 *
 * So it is the only place that gets the app's progress object: the same pale
 * track and upright playhead as the download feed's pipeline and the player's
 * seek bar. It sweeps rather than fills, and that is deliberate — pip resolves a
 * dependency tree of unknown size, so a percentage would be a number we made up.
 * The sentence under it names the package, which is true and answers the same
 * question.
 */
function ScanRail({ label }: { label: string }) {
  return (
    <div role="progressbar" aria-label={label} className="relative h-1.5 rounded-full bg-default">
      <span className="animate-rail-scan absolute inset-0">
        <span className="absolute top-1/2 right-0 h-3 w-[3px] -translate-y-1/2 translate-x-1/2 rounded-full bg-accent shadow-[0_1px_3px_rgb(0_0_0/0.25)]" />
      </span>
    </div>
  );
}

export function EnginePanel() {
  const { t } = useTranslation("onboarding");
  const setup = useSetupEnv();
  const logs = useSetupLogs(setup.isPending);
  const [showLog, setShowLog] = useState(false);

  const phase = installPhase(logs);
  const line =
    phase.kind === "fetching"
      ? t("steps.engine.phase.fetching", { pkg: phase.pkg })
      : t(`steps.engine.phase.${phase.kind}`);

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm">
      <p className="max-w-prose text-[0.8125rem] leading-relaxed text-muted">{t("steps.engine.body")}</p>

      {setup.isError && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>{t("steps.engine.failed")}</Alert.Title>
            <Alert.Description>{String(setup.error)}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {setup.isPending ? (
        <div className="flex flex-col gap-2">
          <ScanRail label={line} />
          <Swap swapKey={line} className="block text-[0.8125rem] text-accent">
            {line}
          </Swap>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button variant="primary" onPress={() => setup.mutate()}>
            <Download className="size-4" />
            {setup.isError ? t("steps.engine.retry") : t("steps.engine.action")}
          </Button>
          <p className="text-xs text-muted">{t("steps.engine.duration")}</p>
        </div>
      )}

      {logs.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={showLog}
            onClick={() => setShowLog((open) => !open)}
            className="flex cursor-pointer items-center gap-1 self-start rounded-sm text-xs font-medium text-muted transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <motion.span initial={false} animate={{ rotate: showLog ? 180 : 0 }} transition={springs.snappy}>
              <ChevronDown className="size-3.5" />
            </motion.span>
            {t("steps.engine.detail")}
          </button>

          <AnimatePresence initial={false}>
            {showLog && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={springs.soft}
                className="overflow-hidden"
              >
                <pre className="max-h-48 overflow-y-auto rounded-xl bg-panel p-3 font-mono text-[0.6875rem] leading-relaxed text-muted">
                  {logs.join("\n")}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
