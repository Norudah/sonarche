import { Alert, Button, Card } from "@heroui/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useSetupEnv, useSetupLogs } from "@/features/onboarding/hooks";
import { canFinishSetup, type SetupStep, type SetupStepId } from "@/features/onboarding/steps";

/**
 * The walkthrough's panels.
 *
 * Split from `SetupGate` so the gate stays a decision — which of the three
 * surfaces owns the window — and this file stays the surface. Chantier 1
 * replaces what is below wholesale (numbered checklist, rail, staged AcoustID
 * guide) without the gate having to know.
 */

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex h-full items-center justify-center">{children}</div>;
}

function PythonMissing({ onRetry, checking }: { onRetry: () => void; checking: boolean }) {
  const { t } = useTranslation("onboarding");
  return (
    <Card className="max-w-lg p-6">
      <Card.Header>
        <Card.Title>{t("pythonMissing.title")}</Card.Title>
        <Card.Description>{t("pythonMissing.description")}</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <code className="rounded-lg bg-default/40 px-3 py-2 text-sm">brew install python</code>
        <Button variant="primary" onPress={onRetry} isDisabled={checking}>
          {t("pythonMissing.retry")}
        </Button>
      </Card.Content>
    </Card>
  );
}

function EngineMissing() {
  const { t } = useTranslation("onboarding");
  const setup = useSetupEnv();
  const logs = useSetupLogs(setup.isPending);

  return (
    <Card className="w-full max-w-2xl p-6">
      <Card.Header>
        <Card.Title>{t("setup.title")}</Card.Title>
        <Card.Description>{t("setup.description")}</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        {setup.isError && (
          <Alert status="danger">
            <Alert.Content>
              <Alert.Title>{t("setup.failed")}</Alert.Title>
              <Alert.Description>{String(setup.error)}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        {setup.isPending && (
          <pre className="max-h-56 overflow-y-auto rounded-lg bg-default/40 p-3 text-xs leading-relaxed">
            {logs.length > 0 ? logs.join("\n") : t("setup.starting")}
          </pre>
        )}
        <Button variant="primary" onPress={() => setup.mutate()} isDisabled={setup.isPending}>
          {setup.isPending ? t("setup.installing") : t("setup.install")}
        </Button>
      </Card.Content>
    </Card>
  );
}

/** Every blocking step is satisfied; only the walkthrough's own flag is left. */
function Ready({ onFinish, isFinishing }: { onFinish: () => void; isFinishing: boolean }) {
  const { t } = useTranslation("onboarding");
  return (
    <Card className="max-w-lg p-6">
      <Card.Header>
        <Card.Title>{t("ready.title")}</Card.Title>
        <Card.Description>{t("ready.description")}</Card.Description>
      </Card.Header>
      <Card.Content>
        <Button variant="primary" onPress={onFinish} isDisabled={isFinishing}>
          {t("ready.action")}
        </Button>
      </Card.Content>
    </Card>
  );
}

export interface SetupFlowProps {
  steps: readonly SetupStep[];
  onRetryPython: () => void;
  isCheckingPython: boolean;
  onFinish: () => void;
  isFinishing: boolean;
}

export function SetupFlow({ steps, onRetryPython, isCheckingPython, onFinish, isFinishing }: SetupFlowProps) {
  const openBlocking = steps.find((step) => step.blocking && step.state !== "satisfied");

  const panels: Record<SetupStepId, ReactNode> = {
    python: <PythonMissing onRetry={onRetryPython} checking={isCheckingPython} />,
    engine: <EngineMissing />,
    acoustid: null,
    library: null,
  };

  return (
    <Centered>
      {openBlocking ? (
        panels[openBlocking.id]
      ) : canFinishSetup(steps) ? (
        <Ready onFinish={onFinish} isFinishing={isFinishing} />
      ) : null}
    </Centered>
  );
}
