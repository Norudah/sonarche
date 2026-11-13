import { Alert } from "@heroui/react";
import { ArrowRight, ChevronDown, Clock, Download, Folder, Package, RotateCcw, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ENGINE_STAGES, type EngineProgress, type EngineStatus } from "@/features/onboarding/engineStages";
import { FactList } from "@/features/onboarding/layout/FactList";
import { SetupActionBar, SetupPrimaryButton } from "@/features/onboarding/layout/SetupActionBar";
import { SetupHeader } from "@/features/onboarding/layout/SetupHeader";
import { SetupBody } from "@/features/onboarding/layout/SetupLayout";
import { StageCard, type StageState } from "@/features/onboarding/layout/StageCard";
import { describeSetupError, type SetupErrorReport } from "@/features/onboarding/setupError";
import type { SetupMode } from "@/features/onboarding/steps";
import type { EngineInstall } from "@/features/onboarding/useEngineInstall";
import { springs } from "@/shared/motion/tokens";
import { Swap } from "@/shared/motion/Swap";
import { ActionButton } from "@/shared/ui/ActionLink";

/** Sweeps rather than fills: pip's work size is unknown. The line below names
 * the current package. */
function ScanRail({ label }: { label: string }) {
  return (
    <div role="progressbar" aria-label={label} className="relative h-1.5 rounded-full bg-default">
      <span className="absolute inset-0 animate-rail-scan">
        <span className="absolute top-1/2 right-0 h-3 w-[3px] translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_1px_3px_rgb(0_0_0/0.25)]" />
      </span>
    </div>
  );
}

function stageState(index: number, status: EngineStatus, progress: EngineProgress): StageState {
  if (index < progress.cleared) return "done";
  if (index !== progress.current) return "pending";
  return status === "error" ? "error" : "busy";
}

function LiveLine({ progress }: { progress: EngineProgress }) {
  const { t } = useTranslation("onboarding");
  const live = progress.live;
  if (!live) return null;
  const line = live.kind === "package" ? t("engine.live.package", { pkg: live.pkg }) : t(`engine.live.${live.kind}`);

  return (
    <div className="mt-1.5 flex flex-col gap-2">
      <ScanRail label={line} />
      <Swap swapKey={line} className="block text-[0.78125rem] font-medium text-accent">
        {line}
      </Swap>
    </div>
  );
}

function InstallLog({ logs, finished }: { logs: readonly string[]; finished: boolean }) {
  const { t } = useTranslation("onboarding");
  const [open, setOpen] = useState(false);
  if (logs.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((shown) => !shown)}
        className="flex min-h-7 cursor-pointer items-center gap-1.5 self-start rounded-sm text-[0.78125rem] font-medium text-muted transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
      >
        <motion.span initial={false} animate={{ rotate: open ? 180 : 0 }} transition={springs.snappy}>
          <ChevronDown className="size-3.5" />
        </motion.span>
        {finished ? t("engine.log.full") : open ? t("engine.log.hide") : t("engine.log.show")}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.soft}
            className="overflow-hidden"
          >
            <pre className="max-h-28 overflow-y-auto rounded-xl bg-tray px-3.5 py-3 font-mono text-[0.6875rem] leading-relaxed whitespace-pre-wrap text-muted">
              {logs.join("\n")}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FailureAlert({ report }: { report: SetupErrorReport }) {
  const { t } = useTranslation("onboarding");
  return (
    <Alert status="danger" className="mt-[22px] bg-danger-soft shadow-none">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{report.cause ? t(`engine.errors.${report.cause}.title`) : t("engine.error.unknown")}</Alert.Title>
        <Alert.Description className="flex flex-col gap-1">
          {report.cause && <span>{t(`engine.errors.${report.cause}.hint`)}</span>}
          <code className="font-mono text-[0.6875rem] break-words opacity-80">{report.line}</code>
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

interface EngineScreenProps {
  mode: SetupMode;
  install: EngineInstall;
  libraryDir: string;
  /** Interpreter and wheels ship with the app: nothing is downloaded. */
  bundled: boolean;
  onBack: (() => void) | null;
  /** To the key screen. */
  onNext: () => void;
  /** Into the app; a repair needs nothing else. */
  onEnter: () => void;
}

export function EngineScreen({ mode, install, libraryDir, bundled, onBack, onNext, onEnter }: EngineScreenProps) {
  const { t } = useTranslation("onboarding");
  const [copied, setCopied] = useState(false);
  const { status, progress, logs } = install;

  const eyebrow = t(mode === "repair" ? "eyebrow.repair" : "eyebrow.welcome");
  const report = install.error ? describeSetupError(install.error, logs, { offline: bundled }) : null;
  const timing = bundled ? "bundled" : "online";

  const header = {
    idle: { title: t(`engine.idle.title.${mode}`), lead: t(`engine.idle.lead.${mode}`) },
    installing: { title: t("engine.installing.title"), lead: t(`engine.installing.lead.${timing}`) },
    done: { title: t(`engine.done.title.${mode}`), lead: t(`engine.done.lead.${mode}`) },
    error: { title: t("engine.error.title"), lead: t(`engine.error.lead.${mode}`) },
  }[status];

  const failedText = report?.cause
    ? t("engine.stages.failedBecause", { reason: t(`engine.errors.${report.cause}.reason`) })
    : t("engine.stages.failed");

  const copyLog = async () => {
    await navigator.clipboard.writeText(logs.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <>
      <SetupBody>
        <SetupHeader eyebrow={eyebrow} title={header.title} lead={header.lead} tone={report ? "danger" : "accent"} />

        {status === "idle" ? (
          <FactList
            facts={[
              {
                icon: Clock,
                title: t(`engine.facts.time.${timing}.title`),
                text: t(`engine.facts.time.${timing}.text`),
              },
              mode === "repair"
                ? {
                    icon: ShieldCheck,
                    title: t("engine.facts.library.repair.title"),
                    text: t("engine.facts.library.repair.text"),
                  }
                : {
                    icon: Folder,
                    title: t("engine.facts.library.firstRun.title", { path: libraryDir }),
                    text: t("engine.facts.library.firstRun.text"),
                  },
              { icon: Package, title: t("engine.facts.isolated.title"), text: t("engine.facts.isolated.text") },
            ]}
          />
        ) : (
          <>
            {report && <FailureAlert report={report} />}
            <StageCard compact={status === "done"} footer={status === "installing" && <LiveLine progress={progress} />}>
              {ENGINE_STAGES.map((stage, index) => {
                const state = stageState(index, status, progress);
                return (
                  <StageCard.Stage
                    key={stage}
                    number={index + 1}
                    state={state}
                    title={t(`engine.stages.${stage}.title`)}
                    text={
                      status === "done" ? undefined : state === "error" ? failedText : t(`engine.stages.${stage}.text`)
                    }
                  />
                );
              })}
            </StageCard>
            <InstallLog logs={logs} finished={status === "done"} />
          </>
        )}
      </SetupBody>

      <SetupActionBar
        onBack={onBack}
        secondary={
          status === "error" ? (
            <ActionButton tone="muted" onPress={() => void copyLog()}>
              {copied ? t("engine.error.copied") : t("engine.error.copyLog")}
            </ActionButton>
          ) : status === "done" && mode === "repair" ? (
            <ActionButton tone="muted" onPress={onNext}>
              {t("key.saved.see")}
            </ActionButton>
          ) : null
        }
        primary={
          status === "idle" ? (
            <SetupPrimaryButton icon={Download} onPress={install.install}>
              {t(`engine.action.${mode}`)}
            </SetupPrimaryButton>
          ) : status === "installing" ? (
            <SetupPrimaryButton isPending>{t("engine.installing.button")}</SetupPrimaryButton>
          ) : status === "error" ? (
            <SetupPrimaryButton icon={RotateCcw} onPress={install.install}>
              {t("engine.error.retry")}
            </SetupPrimaryButton>
          ) : mode === "repair" ? (
            <SetupPrimaryButton trailingIcon={ArrowRight} onPress={onEnter}>
              {t("enter.repair")}
            </SetupPrimaryButton>
          ) : (
            <SetupPrimaryButton trailingIcon={ArrowRight} onPress={onNext}>
              {t("continue")}
            </SetupPrimaryButton>
          )
        }
      />
    </>
  );
}
