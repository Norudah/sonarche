import { Alert, Button, Card, Spinner } from "@heroui/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useEnvStatus, useSetupEnv, useSetupLogs } from "@/features/onboarding/hooks";

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex h-full items-center justify-center">{children}</div>;
}

function PythonMissing({ onRetry, checking }: { onRetry: () => void; checking: boolean }) {
  const { t } = useTranslation("onboarding");
  return (
    <Centered>
      <Card className="max-w-lg p-6">
        <Card.Header>
          <Card.Title>{t("pythonMissing.title")}</Card.Title>
          <Card.Description>{t("pythonMissing.description")}</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <code className="rounded-lg bg-default/40 px-3 py-2 text-sm">
            brew install python
          </code>
          <Button variant="primary" onPress={onRetry} isDisabled={checking}>
            {t("pythonMissing.retry")}
          </Button>
        </Card.Content>
      </Card>
    </Centered>
  );
}

function SetupNeeded() {
  const { t } = useTranslation("onboarding");
  const setup = useSetupEnv();
  const logs = useSetupLogs(setup.isPending);

  return (
    <Centered>
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
          <Button
            variant="primary"
            onPress={() => setup.mutate()}
            isDisabled={setup.isPending}
          >
            {setup.isPending ? t("setup.installing") : t("setup.install")}
          </Button>
        </Card.Content>
      </Card>
    </Centered>
  );
}

export function SetupGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation("onboarding");
  const status = useEnvStatus();

  if (status.isPending) {
    return (
      <Centered>
        <Spinner size="lg" />
      </Centered>
    );
  }

  if (status.isError) {
    return (
      <Centered>
        <Alert status="danger" className="max-w-lg">
          <Alert.Content>
            <Alert.Title>{t("statusError")}</Alert.Title>
            <Alert.Description>{String(status.error)}</Alert.Description>
          </Alert.Content>
        </Alert>
      </Centered>
    );
  }

  if (!status.data.python) {
    return <PythonMissing onRetry={() => status.refetch()} checking={status.isFetching} />;
  }

  if (!status.data.venvOk || !status.data.depsOk) {
    return <SetupNeeded />;
  }

  return <>{children}</>;
}
