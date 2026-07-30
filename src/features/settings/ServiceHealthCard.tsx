import { Button } from "@heroui/react";
import { Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SERVICE_NAMES, type ServiceState, type ServiceStatus } from "@/features/settings/api";
import { SettingCard } from "@/features/settings/SettingCard";
import { useCheckServices } from "@/features/settings/hooks";

/* Three states, three registers. `unreachable` is amber and not red on
 * purpose: from here it is indistinguishable from the user's own connection
 * being down, and accusing a service of being broken when the wifi is off is
 * the one wrong answer this panel can give. */
const DOT: Record<ServiceState, string> = {
  up: "bg-success",
  down: "bg-danger",
  unreachable: "bg-warning",
};

function ServiceRow({ name, status }: { name: string; status: ServiceStatus | undefined }) {
  const { t } = useTranslation("settings");

  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="font-medium">{t(`apiKeys.services.${name}`)}</span>
      {status ? (
        <span className="flex items-center gap-2 text-muted">
          <span className={`size-1.5 shrink-0 rounded-full ${DOT[status.state]}`} />
          {t(`apiKeys.serviceState.${status.state}`)}
          {status.state !== "up" && status.detail && (
            <span className="text-[0.75rem] text-muted/70">({status.detail})</span>
          )}
        </span>
      ) : (
        <span className="text-[0.8125rem] text-muted/70">{t("apiKeys.serviceState.unknown")}</span>
      )}
    </div>
  );
}

/**
 * Are the six outside services answering?
 *
 * This card exists because of a real evening spent proving that missing lyrics
 * were LRCLIB's fault and not Sonarche's — with a terminal, a TLS trace and no
 * help from the app. Every one of these services can go quiet, and every time
 * one does the symptom surfaces somewhere else entirely: an import with no
 * cover, a genre pass that finds nothing, plain-text lyrics where synchronised
 * ones were expected.
 *
 * Nothing runs on mount. Six outbound requests are not something a screen
 * should fire because it happened to be opened — the button is the consent.
 */
export function ServiceHealthCard() {
  const { t } = useTranslation("settings");
  const check = useCheckServices();
  const byName = new Map((check.data ?? []).map((status) => [status.name, status]));

  return (
    <SettingCard>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="font-medium">{t("apiKeys.health.name")}</h3>
            <p className="max-w-prose text-sm text-muted">{t("apiKeys.health.why")}</p>
          </div>
          <Button
            variant="secondary"
            className="shrink-0 rounded-xl"
            onPress={() => check.mutate(undefined)}
            isDisabled={check.isPending}
          >
            {check.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {check.isPending ? t("apiKeys.health.checking") : t("apiKeys.health.action")}
          </Button>
        </div>

        <div className="divide-y divide-separator border-t border-separator">
          {SERVICE_NAMES.map((name) => (
            <ServiceRow key={name} name={name} status={byName.get(name)} />
          ))}
        </div>

        {check.isError && <p className="text-sm text-danger">{t("apiKeys.health.failed")}</p>}
      </div>
    </SettingCard>
  );
}
